import time
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class EphysPreprocessContext(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output data in .nwb.lindi.tar format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')


class EphysPreprocess(ProcessorBase):
    name = 'ephys_preprocess'
    description = 'Run preprocessing on an electrophysiology dataset'
    label = 'ephys_preprocess'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: EphysPreprocessContext
    ):
        import numpy as np
        import pynwb
        from pynwb.ecephys import ElectricalSeries
        import lindi
        from qfc import qfc_estimate_quant_scale_factor
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor
        import spikeinterface.preprocessing as spre

        QFCCodec.register_codec()

        if context.input.file_base_name.endswith('.nwb'):
            print('Creating LINDI file from NWB file')
            url = context.input.get_url()
            assert url, 'No URL for input file'
            with lindi.LindiH5pyFile.from_hdf5_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        elif context.input.file_base_name.endswith('.lindi.json') or context.input.file_base_name.endswith('.lindi.tar'):
            print('Creating LINDI file')
            url = context.input.get_url()
            assert url, 'No URL for input file'
            with lindi.LindiH5pyFile.from_lindi_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        else:
            raise Exception(f'Unexpected file extension: {context.input.file_base_name}')

        print('Reading LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file("output.nwb.lindi.tar", mode="r") as f:
            electrical_series_path = '/acquisition/ElectricalSeries'

            print("Loading recording")
            recording = NwbRecordingExtractor(
                h5py_file=f, electrical_series_path=electrical_series_path
            )
            print(recording.get_channel_ids())

            num_frames = recording.get_num_frames()
            start_time_sec = 0
            # duration_sec = 300
            duration_sec = num_frames / recording.get_sampling_frequency()
            start_frame = int(start_time_sec * recording.get_sampling_frequency())
            end_frame = int(np.minimum(num_frames, (start_time_sec + duration_sec) * recording.get_sampling_frequency()))
            recording = recording.frame_slice(
                start_frame=start_frame,
                end_frame=end_frame
            )

            # bandpass filter
            print("Filtering recording")
            freq_min = 300
            freq_max = 6000
            recording_filtered = spre.bandpass_filter(
                recording, freq_min=freq_min, freq_max=freq_max, dtype=np.float32
            )  # important to specify dtype here
            f.close()

        traces0 = recording_filtered.get_traces(start_frame=0, end_frame=int(1 * recording_filtered.get_sampling_frequency()))
        traces0 = traces0.astype(dtype=traces0.dtype, order='C')

        # noise_level = estimate_noise_level(traces0)
        # print(f'Noise level: {noise_level}')
        # scale_factor = qfc_estimate_quant_scale_factor(traces0, target_residual_stdev=noise_level * 0.2)

        compression_method = 'zlib'
        zlib_level = 3
        zstd_level = 3

        scale_factor = qfc_estimate_quant_scale_factor(
            traces0,
            target_compression_ratio=10,
            compression_method=compression_method,
            zlib_level=zlib_level,
            zstd_level=zstd_level
        )
        print(f'Quant. scale factor: {scale_factor}')
        codec = QFCCodec(
            quant_scale_factor=scale_factor,
            dtype='float32',
            segment_length=int(recording_filtered.get_sampling_frequency() * 1),
            compression_method=compression_method,
            zlib_level=zlib_level,
            zstd_level=zstd_level
        )
        traces0_compressed = codec.encode(traces0)
        compression_ratio = traces0.size * 2 / len(traces0_compressed)
        print(f'Compression ratio: {compression_ratio}')

        print("Writing filtered recording to LINDI file")
        with lindi.LindiH5pyFile.from_lindi_file("output.nwb.lindi.tar", mode="a") as f:
            with pynwb.NWBHDF5IO(file=f, mode='a') as io:
                nwbfile = io.read()

                electrical_series = nwbfile.acquisition['ElectricalSeries']  # type: ignore
                electrical_series_pre = ElectricalSeries(
                    name="ElectricalSeries_pre",
                    data=pynwb.H5DataIO(
                        recording_filtered.get_traces(),  # type: ignore
                        chunks=(30000, recording.get_num_channels()),
                        compression=codec
                    ),
                    electrodes=electrical_series.electrodes,
                    starting_time=0.0,  # timestamp of the first sample in seconds relative to the session start time
                    rate=recording_filtered.get_sampling_frequency(),
                )
                nwbfile.add_acquisition(electrical_series_pre)  # type: ignore
                io.write(nwbfile)  # type: ignore

        print('Uploading output')
        context.output.upload('output.nwb.lindi.tar')


def compute_estimated_channel_firing_rates(recording):
    import numpy as np
    import spikeinterface as si
    timestamp_last_print = time.time()
    R: si.BaseRecording = recording
    chunk_duration_sec = 5
    chunk_duration_frames = int(chunk_duration_sec * R.get_sampling_frequency())
    num_chunks = int(R.get_num_frames() / chunk_duration_frames)
    X = np.zeros((num_chunks, R.get_num_channels()))
    for ss in range(num_chunks):
        elapsed_since_last_print = time.time() - timestamp_last_print
        if elapsed_since_last_print > 10:
            print(f'Computing estimated channel firing rates: {ss} of {num_chunks} time chunks')
            timestamp_last_print = time.time()
        traces = R.get_traces(start_frame=int(ss * chunk_duration_frames), end_frame=int((ss + 1) * chunk_duration_frames))
        for m in range(R.get_num_channels()):
            X[ss, m] = estimate_num_spikes(traces[:, m]) / chunk_duration_sec
    return np.mean(X, axis=0)


def compute_channel_power_spectra(recording):
    import numpy as np
    import spikeinterface as si
    timestamp_last_print = time.time()
    R: si.BaseRecording = recording
    chunk_duration_sec = 5
    chunk_duration_frames = int(chunk_duration_sec * R.get_sampling_frequency())
    num_chunks = int(R.get_num_frames() / chunk_duration_frames)
    freqs = np.fft.fftfreq(chunk_duration_frames, 1 / R.get_sampling_frequency())
    freqs = freqs[:int(chunk_duration_frames / 2)]
    X = np.zeros((num_chunks, R.get_num_channels(), len(freqs)))
    for ss in range(num_chunks):
        elapsed_since_last_print = time.time() - timestamp_last_print
        if elapsed_since_last_print > 10:
            print(f'Computing channel power spectra: {ss} of {num_chunks} time chunks')
            timestamp_last_print = time.time()
        traces = R.get_traces(start_frame=int(ss * chunk_duration_frames), end_frame=int((ss + 1) * chunk_duration_frames))
        for m in range(R.get_num_channels()):
            X[ss, m, :] = np.abs(np.fft.fft(traces[:, m]))[:int(chunk_duration_frames / 2)] ** 2
    X_mean = np.mean(X, axis=0)
    # subsample to 1000 points
    X_mean = X_mean[:, ::int(len(freqs) / 1000)]
    freqs = freqs[::int(len(freqs) / 1000)]
    return freqs, X_mean


def estimate_num_spikes(trace):
    import numpy as np
    X: np.ndarray = trace
    # normalize
    X = X - np.mean(X)
    X = X / np.std(X)
    detect_threshold = 5
    candidate_times = np.where(X < -detect_threshold)[0]  # assume spikes are negative
    detect_interval = 20
    # don't double count times that are within detect_interval of each other
    times = []
    last_detect_time = -1000
    for t in candidate_times:
        if t - last_detect_time > detect_interval:
            times.append(t)
            last_detect_time = t
    return len(times)


# def _process_lindi_file(fname: str):
#     import numpy as np
#     from lindi.LindiH5pyFile.LindiReferenceFileSystemStore import LindiReferenceFileSystemStore
#     import json

#     with open(fname, 'r') as f:
#         rfs = json.load(f)

#     store = LindiReferenceFileSystemStore(rfs)

#     refs = rfs['refs']
#     for k in refs.keys():
#         zarray_key = f'{k}/.zarray'
#         if zarray_key in refs:
#             v = store.get(zarray_key)
#             assert v
#             zarray = json.loads(v)
#             chunk_shape = zarray.get('chunks')
#             shape = zarray.get('shape')
#             should_be_split = False
#             if not zarray.get('compressor') and not zarray.get('filters'):
#                 if chunk_shape == shape:
#                     if np.prod(shape) > 1000 * 1000 * 20:
#                         should_be_split = True
#             if should_be_split:
#                 print(f'Splitting {k}')
#                 zeros = ['0' for _ in range(len(shape))]
#                 chunk_key = f"{k}/{zeros.join('.')}"
#                 chunk_val = refs[chunk_key]
#                 url0 = chunk_val[0]
#                 offset0 = chunk_val[1]
#                 size0 = chunk_val[2]
#                 del refs[chunk_key]
#                 nn = ...
#                 num_chunks = shape[0] // nn
#                 zarray['chunks'] = [nn] + shape[1:]
#                 for i in range(0, int(shape[0]), size0):
#                     zeros = ['0' for _ in range(len(shape) - 1)]
#                     chunk_key = f"{k}/{i}.{zeros.join('.')}"
#                     refs[chunk_key] = [url0, offset0 + i * size0, size0]