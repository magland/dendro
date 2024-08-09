import numpy as np
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class SpikeSortingPostProcessingContext(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='New NWB file in .nwb.lindi.tar format')
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
        from helpers.compute_correlogram_data import compute_correlogram_data

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
            f.write_lindi_file('output.nwb.lindi.tar')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar', mode="r+", local_cache=cache) as f:
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
                    h5py_file=f,
                    unit_table_path=units_path,
                    electrical_series_path=electrical_series_path
                )
                unit_ids = sorting.get_unit_ids()

                print('Writing float32 recording to disk')
                recording_binary = make_float32_recording(recording, dirname='recording_float32')

                colnames = units.attrs['colnames']
                if isinstance(colnames, np.ndarray):
                    colnames = colnames.tolist()
                else:
                    assert isinstance(colnames, list)

                spike_trains = [
                    sorting.get_unit_spike_train(unit_id) for unit_id in unit_ids
                ]

                colnames.append('num_spikes')
                units.create_dataset('num_spikes', data=[
                    len(spike_train) for spike_train in spike_trains
                ], dtype=np.int64)

                colnames.append('firing_rate')
                duration_sec = recording.get_num_frames() / recording.get_sampling_frequency()
                units.create_dataset('firing_rate', data=[
                    len(spike_train) / duration_sec for spike_train in spike_trains
                ], dtype=np.float32)

                correlogram_window_size_msec = 100
                correlogram_bin_size_msec = 1
                bin_edges_sec_list = []
                bin_counts_list = []
                for i in range(len(unit_ids)):
                    spike_train = spike_trains[i] / recording.get_sampling_frequency()
                    r = compute_correlogram_data(
                        spike_train_1=spike_train,
                        spike_train_2=None,
                        window_size_msec=correlogram_window_size_msec,
                        bin_size_msec=correlogram_bin_size_msec
                    )
                    bin_edges_sec = r['bin_edges_sec']
                    bin_counts = r['bin_counts']
                    bin_edges_sec_list.append(bin_edges_sec)
                    bin_counts_list.append(bin_counts)

                bin_counts = np.zeros((len(unit_ids), len(bin_counts_list[0])), dtype=np.uint32)
                for i in range(len(unit_ids)):
                    bin_counts[i, :] = bin_counts_list[i]
                colnames.append('acg')
                units.create_dataset('acg', data=bin_counts, dtype=np.uint32)
                bin_edges_sec = np.zeros((len(unit_ids), len(bin_edges_sec_list[0])), dtype=np.float32)
                for i in range(len(unit_ids)):
                    bin_edges_sec[i, :] = bin_edges_sec_list[i]
                colnames.append('acg_bin_edges')
                units.create_dataset('acg_bin_edges', data=bin_edges_sec, dtype=np.float32)

                units.attrs['colnames'] = colnames

                # print('Writing NWB file')
                # io.write(nwbfile)  # type: ignore

        print('Uploading output file')
        output.upload('output.nwb.lindi.tar')
