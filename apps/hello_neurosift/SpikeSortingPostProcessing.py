import numpy as np
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class SpikeSortingPostProcessingContext(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    units_path: str = Field(description='Path to the units object in the NWB file')


class SpikeSortingPostProcessingDataset(ProcessorBase):
    name = 'spike_sorting_post_processing'
    description = 'Run post processing on an electrophysiology dataset after spike sorting and add columns to the units table'
    label = 'spike_sorting_post_processing'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: SpikeSortingPostProcessingContext
    ):
        import pynwb
        import lindi
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor, NwbSortingExtractor
        from helpers.make_float32_recording import make_float32_recording

        QFCCodec.register_codec()

        input = context.input
        output = context.output
        electrical_series_path = context.electrical_series_path
        units_path = context.units_path

        cache = lindi.LocalCache(cache_dir='lindi_cache')

        print('Creating LINDI file')
        url = input.get_url()
        assert url, 'No URL for input file'
        with lindi.LindiH5pyFile.from_lindi_file(url) as f:
            f.write_lindi_file('output.nwb.lindi')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi', mode="r+", local_cache=cache) as f:
            units = f[units_path]
            assert isinstance(units, lindi.LindiH5pyGroup)

            print('Reading NWB file')
            with pynwb.NWBHDF5IO(file=f, mode='a') as io:
                nwbfile = io.read()
                print('Loading recording')
                recording = NwbRecordingExtractor(
                    h5py_file=f, electrical_series_path=electrical_series_path
                )

                print('Loading sorting')
                sorting = NwbSortingExtractor(
                    h5py_file=f, units_path=units_path
                )
                unit_ids = sorting.get_unit_ids()

                print('Writing float32 recording to disk')
                recording_binary = make_float32_recording(recording, dirname='recording_float32')

                colnames = units.attrs['colnames']
                assert isinstance(colnames, list)

                colnames.append('num_spikes')
                units.create_dataset('num_spikes', data=np.zeros(len(unit_ids), dtype=np.int64))

                units.attrs['colnames'] = colnames

                # print('Writing NWB file')
                # io.write(nwbfile)  # type: ignore

        print('Uploading output file')
        output.upload('output.nwb.lindi')
