import numpy as np
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class MountainSort5Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb.lindi format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    output_units_name: str = Field(description='Name of the output units object')
    detect_threshold: float = Field(description='Threshold for spike detection')


class MountainSort5(ProcessorBase):
    name = 'mountainsort5'
    description = 'Run spike sorting using MountainSort5'
    label = 'mountainsort5'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: MountainSort5Context
    ):
        import lindi
        import pynwb
        from pynwb.misc import Units
        from pynwb.file import ProcessingModule
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor
        from helpers.make_float32_recording import make_float32_recording
        from helpers._scale_recording_if_float_type import _scale_recording_if_float_type
        import spikeinterface.preprocessing as spre
        import spikeinterface as si
        import mountainsort5 as ms5

        QFCCodec.register_codec()

        input = context.input
        output = context.output
        electrical_series_path = context.electrical_series_path
        output_units_name = context.output_units_name
        detect_threshold = context.detect_threshold

        cache = lindi.LocalCache(cache_dir='lindi_cache')

        print('Creating LINDI file')
        url = input.get_url()
        assert url, 'No URL for input file'
        with lindi.LindiH5pyFile.from_lindi_file(url) as f:
            f.write_lindi_file('output.nwb.lindi')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi', mode="r+", local_cache=cache) as f:
            print('Reading NWB file')
            with pynwb.NWBHDF5IO(file=f, mode='a') as io:
                nwbfile = io.read()
                print('Setting up recording')
                recording = NwbRecordingExtractor(
                    h5py_file=f, electrical_series_path=electrical_series_path
                )

                print("Whitening")
                # see comment in _scale_recording_if_float_type
                recording_scaled = _scale_recording_if_float_type(recording)
                recording_whitened: si.BaseRecording = spre.whiten(
                    recording_scaled,
                    dtype="float32",
                    num_chunks_per_segment=1,  # by default this is 20 which takes a long time to load depending on the chunking
                    chunk_size=int(1e5),
                )

                print('Writing float32 recording to disk')
                recording_binary = make_float32_recording(recording_whitened, dirname='recording_float32')

                print("Setting up sorting parameters")
                scheme1_detect_channel_radius = None
                detect_time_radius_msec = 0.5
                detect_sign = -1
                snippet_T1 = 20
                snippet_T2 = 20
                snippet_mask_radius = None
                npca_per_channel = 3
                npca_per_subdivision = 10
                scheme1_sorting_parameters = ms5.Scheme1SortingParameters(
                    detect_threshold=detect_threshold,
                    detect_channel_radius=scheme1_detect_channel_radius,
                    detect_time_radius_msec=detect_time_radius_msec,
                    detect_sign=detect_sign,
                    snippet_T1=snippet_T1,
                    snippet_T2=snippet_T2,
                    snippet_mask_radius=snippet_mask_radius,
                    npca_per_channel=npca_per_channel,
                    npca_per_subdivision=npca_per_subdivision,
                )

                print("Sorting scheme 1")
                sorting = ms5.sorting_scheme1(
                    recording=recording_binary,
                    sorting_parameters=scheme1_sorting_parameters,
                )
                assert isinstance(sorting, si.BaseSorting)
                print('Unit IDs:', sorting.get_unit_ids())

                print('Adding units to NWB file')
                units_table = Units(name=output_units_name, description='Units from MountainSort5')
                unit_ids = sorting.get_unit_ids()
                for i, unit_id in enumerate(unit_ids):
                    st = sorting.get_unit_spike_train(unit_id=unit_id)
                    spike_times = st / recording.get_sampling_frequency()
                    units_table.add_unit(spike_times=spike_times, id=i + 1)  # unit ID must be an int
                if 'ecephys' not in nwbfile.processing:  # type: ignore
                    ecephys_module = ProcessingModule(name='ecephys', description='Processed extracellular electrophysiology data')
                    nwbfile.add_processing_module(ecephys_module)  # type: ignore
                nwbfile.processing["ecephys"].add(units_table)  # type: ignore

                print('Writing NWB file')
                io.write(nwbfile)  # type: ignore

        print('Uploading output file')
        output.upload('output.nwb.lindi')


def estimate_noise_level(traces):
    noise_level = np.median(np.abs(traces - np.median(traces))) / 0.6745
    return noise_level
