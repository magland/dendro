from pairio.sdk import (
    ProcessorBase,
    BaseModel,
    Field,
    InputFile,
    OutputFile
)


class Kilosort4Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb.lindi.tar format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi.tar format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    output_units_name: str = Field(description='Name of the output units object')


class Kilosort4(ProcessorBase):
    name = "kilosort4"
    description = "Run spike sorting using Kilosort4"
    label = "kilosort4"
    image = "magland/pairio-hello-kilosort4:0.1.0"
    executable = "/app/main.py"
    attributes = {}

    @staticmethod
    def run(context: Kilosort4Context):
        import lindi
        import pynwb
        from pynwb.misc import Units
        from pynwb.file import ProcessingModule
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor
        import spikeinterface.sorters as ss
        import spikeinterface as si
        from helpers.make_float32_recording import make_float32_recording

        QFCCodec.register_codec()

        input = context.input
        output = context.output
        electrical_series_path = context.electrical_series_path
        output_units_name = context.output_units_name

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

                print('Writing float32 recording to disk')
                recording_binary = make_float32_recording(recording, dirname='recording_float32')

                sorter_params = {}
                sorting = ss.run_sorter(
                    'kilosort4',
                    recording=recording_binary,
                    output_folder='tmp_kilosort4',
                    delete_output_folder=True,
                    verbose=True,
                    **sorter_params
                )
                assert isinstance(sorting, si.BaseSorting)
                print('Unit IDs:', sorting.get_unit_ids())

                print('Adding units to NWB file')
                units_table = Units(name=output_units_name, description='Units from Kilosort4')
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
