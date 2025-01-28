import os
import numpy as np
from dendro.sdk import ProcessorBase, InputFile, OutputFile
from pydantic import BaseModel, Field


class MountainSort5Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb.lindi.tar format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi.tar format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    output_units_name: str = Field(description='Name of the output units object')
    detect_threshold: float = Field(description='Threshold for spike detection')
    channel_radius: float = Field(description='Channel radius for spike detection')


class MountainSort5(ProcessorBase):
    name = 'mountainsort5'
    description = 'Run spike sorting using MountainSort5'
    label = 'mountainsort5'
    image = 'magland/dendro-hello-neurosift:0.1.0'
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
        channel_radius = context.channel_radius

        # Important: use of local cache causes severe slowdowns on dandihub
        # cache = lindi.LocalCache(cache_dir='lindi_cache')
        cache = None

        print('Creating LINDI file')
        url = input.get_url()
        assert url, 'No URL for input file'
        with lindi.LindiH5pyFile.from_lindi_file(url) as f:
            f.write_lindi_file('output.nwb.lindi.tar')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar', mode="r+", local_cache=cache) as f:
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
                detect_time_radius_msec = 0.5
                detect_sign = -1
                snippet_T1 = 20
                snippet_T2 = 20
                snippet_mask_radius = None
                npca_per_channel = 3
                npca_per_subdivision = 10
                training_duration_sec = min(300, recording.get_num_frames() / recording.get_sampling_frequency())
                scheme2_sorting_parameters = ms5.Scheme2SortingParameters(
                    phase1_detect_channel_radius=channel_radius,
                    detect_channel_radius=channel_radius,
                    phase1_detect_threshold=detect_threshold,
                    phase1_detect_time_radius_msec=detect_time_radius_msec,
                    detect_time_radius_msec=detect_time_radius_msec,
                    phase1_npca_per_channel=npca_per_channel,
                    phase1_npca_per_subdivision=npca_per_subdivision,
                    detect_sign=detect_sign,
                    detect_threshold=detect_threshold,
                    snippet_T1=snippet_T1,
                    snippet_T2=snippet_T2,
                    snippet_mask_radius=snippet_mask_radius,
                    max_num_snippets_per_training_batch=200,
                    classifier_npca=None,  # None means uses the default for the number of channels
                    training_duration_sec=training_duration_sec,
                    training_recording_sampling_mode='uniform',
                    classification_chunk_sec=None
                )

                print("Sorting scheme 1")
                sorting = ms5.sorting_scheme2(
                    recording=recording_binary,
                    sorting_parameters=scheme2_sorting_parameters,
                )
                assert isinstance(sorting, si.BaseSorting)
                print('Unit IDs:', sorting.get_unit_ids())

                print('Adding units to NWB file')
                dendro_job_id = os.getenv('JOB_ID', None)
                description = 'Units from MountainSort5.'
                if dendro_job_id is not None:
                    description += f' dendro:{dendro_job_id}'
                units_table = Units(
                    name=output_units_name,
                    description=description
                )
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
        output.upload('output.nwb.lindi.tar')


def estimate_noise_level(traces):
    noise_level = np.median(np.abs(traces - np.median(traces))) / 0.6745
    return noise_level
