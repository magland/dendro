from typing import List
import numpy as np
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class PrepareEphysSpikeSortingDatasetContext(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi.tar format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    duration_sec: float = Field(description='Duration of the recording to process, or 0 to process the entire recording')
    electrode_indices: List[int] = Field(description='List of electrode indices to process')
    freq_min: float = Field(description='Minimum frequency for bandpass filter')
    freq_max: float = Field(description='Maximum frequency for bandpass filter')
    compression_ratio: float = Field(description='Target compression ratio')
    output_electrical_series_name: str = Field(description='Name of the output electrical series object')


class PrepareEphysSpikeSortingDataset(ProcessorBase):
    name = 'prepare_ephys_spike_sorting_dataset'
    description = 'Run preprocessing on an electrophysiology dataset in preparation for spike sorting'
    label = 'prepare_ephys_spike_sorting_dataset'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: PrepareEphysSpikeSortingDatasetContext
    ):
        import pynwb
        from pynwb.ecephys import ElectricalSeries
        from hdmf.common.table import DynamicTableRegion
        import lindi
        from qfc import qfc_estimate_quant_scale_factor
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor
        from helpers.make_float32_recording import make_float32_recording
        import spikeinterface.preprocessing as spre

        QFCCodec.register_codec()

        input = context.input
        output = context.output
        electrical_series_path = context.electrical_series_path
        duration_sec = context.duration_sec
        electrode_indices = context.electrode_indices
        freq_min = context.freq_min
        freq_max = context.freq_max
        compression_ratio = context.compression_ratio
        output_electrical_series_name = context.output_electrical_series_name

        # Important: use of local cache causes severe slowdowns on dandihub
        # cache = lindi.LocalCache(cache_dir='lindi_cache')
        cache = None

        if input.file_base_name.endswith('.nwb'):
            print('Creating LINDI file from NWB file')
            url = input.get_url()
            assert url, 'No URL for input file'
            with lindi.LindiH5pyFile.from_hdf5_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        elif input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            print('Creating LINDI file')
            url = input.get_url()
            assert url, 'No URL for input file'
            with lindi.LindiH5pyFile.from_lindi_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        else:
            raise Exception(f'Unexpected file extension: {input.file_base_name}')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar', mode="r+", local_cache=cache) as f:
            print('Reading NWB file')
            with pynwb.NWBHDF5IO(file=f, mode='a') as io:
                nwbfile = io.read()
                print('Setting up recording')
                recording = NwbRecordingExtractor(
                    h5py_file=f, electrical_series_path=electrical_series_path
                )

                if duration_sec > 0:
                    start_frame = 0
                    end_frame = int(duration_sec * recording.get_sampling_frequency())
                    if end_frame > recording.get_num_frames():
                        end_frame = recording.get_num_frames()
                    print(f'Extracting segment from frame {start_frame} to {end_frame}')
                    recording = recording.frame_slice(start_frame=start_frame, end_frame=end_frame)

                channel_ids = recording.get_channel_ids()
                channel_ids_to_use = [channel_ids[ind] for ind in electrode_indices]
                print(f'Using channel IDs: {", ".join([str(ch) for ch in channel_ids_to_use])}')
                recording = recording.channel_slice(channel_ids=channel_ids_to_use)

                print(f'Bandpass filtering recording from {freq_min} to {freq_max} Hz')
                recording_filtered = spre.bandpass_filter(
                    recording, freq_min=freq_min, freq_max=freq_max, dtype=np.float32
                )  # important to specify dtype here

                print('Writing float32 recording to disk')
                recording_binary = make_float32_recording(recording_filtered, dirname='recording_float32')

                print('Determining scale factor')
                traces0 = recording_binary.get_traces(start_frame=0, end_frame=int(1 * recording_binary.get_sampling_frequency()))
                traces0 = traces0.astype(dtype=traces0.dtype, order='C')
                compression_method = 'zlib'
                target_compression_ratio = compression_ratio
                zlib_level = 3
                zstd_level = 3

                if target_compression_ratio > 0:
                    scale_factor = qfc_estimate_quant_scale_factor(
                        traces0,
                        target_compression_ratio=target_compression_ratio,
                        compression_method=compression_method,
                        zlib_level=zlib_level,
                        zstd_level=zstd_level
                    )
                    print(f'Using quantization scale factor: {scale_factor}')
                else:
                    noise_level = estimate_noise_level(traces0)
                    scale_factor = qfc_estimate_quant_scale_factor(traces0, target_residual_stdev=noise_level * 0.05)
                    print(f'Noise level: {noise_level}, using quantization scale factor: {scale_factor}')

                print('Creating codec')
                codec = QFCCodec(
                    quant_scale_factor=scale_factor,
                    dtype='float32',
                    segment_length=int(recording_binary.get_sampling_frequency() * 1),
                    compression_method=compression_method,
                    zlib_level=zlib_level,
                    zstd_level=zstd_level
                )

                electrical_series_name = electrical_series_path.split('/')[-1]
                electrical_series = nwbfile.acquisition[electrical_series_name]  # type: ignore

                electrodes = electrical_series.electrodes
                new_electrodes = DynamicTableRegion(
                    name=electrodes.name,
                    data=[electrodes.data[i] for i in electrode_indices],
                    description=electrodes.description,
                    table=electrodes.table
                )

                print(f'Creating new electrical series: {output_electrical_series_name}')
                electrical_series_pre = ElectricalSeries(
                    name=output_electrical_series_name,
                    data=pynwb.H5DataIO(
                        # TODO: figure out a different way to do this because we don't want to load the entire recording into memory
                        recording_binary.get_traces(),  # type: ignore
                        chunks=(int(recording.get_sampling_frequency() * 1), recording.get_num_channels()),
                        compression=codec
                    ),
                    electrodes=new_electrodes,
                    starting_time=0.0,  # timestamp of the first sample in seconds relative to the session start time
                    rate=recording_binary.get_sampling_frequency(),
                )
                print('Adding new electrical series to NWB file')
                nwbfile.add_acquisition(electrical_series_pre)  # type: ignore
                print('Writing NWB file')
                io.write(nwbfile)  # type: ignore

        print('Uploading output file')
        output.upload('output.nwb.lindi.tar')


def estimate_noise_level(traces):
    noise_level = np.median(np.abs(traces - np.median(traces))) / 0.6745
    return noise_level
