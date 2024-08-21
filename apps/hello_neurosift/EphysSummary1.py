import time
from dendro.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class EphysSummary1Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output data in .lindi.tar format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    segment_start_time_sec: float = Field(description='Start time of segment to analyze in seconds')
    segment_duration_sec: float = Field(description='Duration of segment to analyze in seconds')


class EphysSummary1(ProcessorBase):
    name = 'ephys_summary_1'
    description = 'Compute summary information for an electrophysiology dataset'
    label = 'ephys_summary_1'
    image = 'magland/dendro-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: EphysSummary1Context
    ):
        import numpy as np
        import lindi
        import h5py
        from helpers.nwbextractors import NwbRecordingExtractor
        import spikeinterface.preprocessing as spre

        electrical_series_path = context.electrical_series_path
        start_time_sec = context.segment_start_time_sec
        duration_sec = context.segment_duration_sec

        input = context.input
        url = input.get_url()
        assert url

        # Important: use of local cache causes severe slowdowns on dandihub
        # cache = lindi.LocalCache(cache_dir='lindi_cache')
        local_cache = None

        print('Loading file')
        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            f = lindi.LindiH5pyFile.from_lindi_file(url, local_cache=local_cache)
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url, local_cache=local_cache)

        print('Gathering file information')
        g = f[electrical_series_path]
        assert isinstance(g, h5py.Group)
        ndt = g.attrs['neurodata_type']
        if ndt != 'ElectricalSeries':
            raise Exception(f'Invalid neurodata_type for electrical series object: {ndt} != ElectricalSeries')

        print('Loading recording')
        recording = NwbRecordingExtractor(h5py_file=f, electrical_series_path=electrical_series_path)

        print('Extracting segment to analyze')
        num_frames = recording.get_num_frames()
        start_frame = int(start_time_sec * recording.get_sampling_frequency())
        end_frame = int(np.minimum(num_frames, (start_time_sec + duration_sec) * recording.get_sampling_frequency()))
        recording = recording.frame_slice(
            start_frame=start_frame,
            end_frame=end_frame
        )

        print('Filtering recording')
        freq_max = min(6000, recording.get_sampling_frequency() / 2)
        if freq_max < 6000:
            print(f'Warning: setting freq_max to {freq_max} Hz')
        recording = spre.bandpass_filter(recording, freq_min=300, freq_max=freq_max)

        print('Getting channel ids')
        channel_ids = recording.get_channel_ids()

        print('Estimating channel firing rates')
        estimated_channel_firing_rates = compute_estimated_channel_firing_rates(recording)

        print('Computing channel power spectra')
        ps_freq, ps = compute_channel_power_spectra(recording)

        print('Saving output')
        with lindi.LindiH5pyFile.from_lindi_file('ephys_summary.lindi.tar', mode='w') as f:
            f.attrs['channel_ids'] = [str(ch) for ch in channel_ids]
            f.create_dataset('estimated_channel_firing_rates', data=estimated_channel_firing_rates)
            ps_group = f.create_group('channel_power_spectra')
            ps_group.create_dataset('freq', data=ps_freq)
            ps_group.create_dataset('ps', data=ps)

        context.output.upload('ephys_summary.lindi.tar')


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