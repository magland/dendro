import time
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile, upload_additional_job_output

class UnitsSummary1Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.json format')
    output: OutputFile = Field(description='Output data in .lindi.json format')
    units_path: str = Field(description='Path to the units table in the NWB file', default='units')
    correlogram_window_size_msec: float = Field(description='Correlogram window size in milliseconds', default=100)
    correlogram_bin_size_msec: float = Field(description='Correlogram bin size in milliseconds', default=1)


class UnitsSummary1(ProcessorBase):
    name = 'units_summary_1'
    description = 'Compute autocorrelograms for a units table in an NWB file'
    label = 'units_summary_1'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: UnitsSummary1Context
    ):
        import lindi
        import numpy as np
        import h5py
        from helpers.compute_correlogram_data import compute_correlogram_data

        units_path = context.units_path
        correlogram_window_size_msec = context.correlogram_window_size_msec
        correlogram_bin_size_msec = context.correlogram_bin_size_msec

        input = context.input
        url = input.get_url()
        assert url

        if input.file_base_name.endswith('.lindi.json'):
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

        with open('units_summary.h5', 'wb') as f:
            with h5py.File(f, 'w') as hf:
                hf.create_dataset('autocorrelograms', data=autocorrelograms_array)
                hf.attrs['correlogram_window_size_msec'] = correlogram_window_size_msec
                hf.attrs['correlogram_bin_size_msec'] = correlogram_bin_size_msec
                hf.attrs['correlogram_num_bins'] = num_bins
                hf.attrs['num_units'] = num_units

        upload_h5_as_lindi_output(
            h5_fname='units_summary.h5',
            output=context.output
        )


def upload_h5_as_lindi_output(
    h5_fname,
    output: OutputFile,
    remote_fname='output.h5'
):
    import lindi
    h5_url = upload_additional_job_output(h5_fname, remote_fname=remote_fname)
    f = lindi.LindiH5pyFile.from_hdf5_file(h5_url)
    lindi_fname = h5_fname + '.lindi.json'
    f.write_lindi_file(lindi_fname)
    output.upload(lindi_fname)
