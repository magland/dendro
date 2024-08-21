import time
from dendro.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class UnitsSummary1Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output data in .lindi.tar format')
    units_path: str = Field(description='Path to the units table in the NWB file', default='units')
    correlogram_window_size_msec: float = Field(description='Correlogram window size in milliseconds', default=100)
    correlogram_bin_size_msec: float = Field(description='Correlogram bin size in milliseconds', default=1)


class UnitsSummary1(ProcessorBase):
    name = 'units_summary_1'
    description = 'Compute autocorrelograms for a units table in an NWB file'
    label = 'units_summary_1'
    image = 'magland/dendro-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: UnitsSummary1Context
    ):
        import lindi
        import numpy as np
        from helpers.compute_correlogram_data import compute_correlogram_data

        units_path = context.units_path
        correlogram_window_size_msec = context.correlogram_window_size_msec
        correlogram_bin_size_msec = context.correlogram_bin_size_msec

        input = context.input
        url = input.get_url()
        assert url

        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            f = lindi.LindiH5pyFile.from_lindi_file(url)
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url)

        # Load the spike data
        spike_times: np.ndarray = f[f'{units_path}/spike_times'][()]  # type: ignore
        spike_times_index: np.ndarray = f[f'{units_path}/spike_times_index'][()]  # type: ignore
        spike_trains = []
        offset = 0
        for i in range(len(spike_times_index)):
            st = spike_times[offset:int(spike_times_index[i])]
            # exclude the NaN from the spike times
            st = st[~np.isnan(st)]
            spike_trains.append(st)
            offset = int(spike_times_index[i])
        num_units = len(spike_trains)
        unit_ids = f[f'{units_path}/id'][()]  # type: ignore

        # Compute autocorrelograms for all the units
        print('Computing autocorrelograms')
        auto_correlograms = []
        p = 0
        timer = time.time()
        for i in range(num_units):
            spike_train = spike_times[p:spike_times_index[i]]
            elapsed = time.time() - timer
            if elapsed > 2:
                print(f'Computing autocorrelogram for unit {i + 1} of {num_units} ({len(spike_train)} spikes)')
                timer = time.time()
            r = compute_correlogram_data(
                spike_train_1=spike_train,
                spike_train_2=None,
                window_size_msec=correlogram_window_size_msec,
                bin_size_msec=correlogram_bin_size_msec
            )
            bin_edges_sec = r['bin_edges_sec']
            bin_counts = r['bin_counts']
            auto_correlograms.append({
                'bin_edges_sec': bin_edges_sec,
                'bin_counts': bin_counts
            })
            p = spike_times_index[i]
        num_bins = len(auto_correlograms[0]['bin_counts'])
        autocorrelograms_array = np.zeros(
            (num_units, num_bins),
            dtype=np.uint32
        )
        for i, ac in enumerate(auto_correlograms):
            autocorrelograms_array[i, :] = ac['bin_counts']

        with lindi.LindiH5pyFile.from_lindi_file('units_summary.lindi.tar', mode='w') as f:
            x = f.create_dataset('autocorrelograms', data=autocorrelograms_array)
            x.attrs['bin_edges_sec'] = auto_correlograms[0]['bin_edges_sec']
            f.attrs['correlogram_window_size_msec'] = correlogram_window_size_msec
            f.attrs['correlogram_bin_size_msec'] = correlogram_bin_size_msec
            f.attrs['correlogram_num_bins'] = num_bins
            f.attrs['num_units'] = num_units
            f.attrs['unit_ids'] = [str(uid) for uid in unit_ids]

        context.output.upload('units_summary.lindi.tar')
