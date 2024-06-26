from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class CebraNwbEmbedding2Context(BaseModel):
    input: InputFile = Field(description='Input NWB file')
    output: OutputFile = Field(description='Output embedding in .h5 format')
    max_iterations: int = Field(description='Maximum number of iterations', default=2000)
    batch_size: int = Field(description='Batch size', default=1000)
    bin_size_msec: float = Field(description='Bin size in milliseconds', default=20)
    time_offsets: int = Field(description='Time offsets', default=10)
    output_dimensions: int = Field(description='Output dimensions', default=10)

class CebraNwbEmbedding2(ProcessorBase):
    name = 'cebra_nwb_embedding_2'
    description = 'Create a CEBRA embedding from a units table in an NWB file'
    label = 'cebra_nwb_embedding_2'
    image = 'magland/pairio-hello-cebra:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: CebraNwbEmbedding2Context
    ):
        import lindi
        import numpy as np
        import cebra
        import torch
        import h5py

        batch_size = context.batch_size
        bin_size_msec = context.bin_size_msec
        max_iterations = context.max_iterations
        time_offsets = context.time_offsets
        output_dimensions = context.output_dimensions

        bin_size_sec = bin_size_msec / 1000

        input = context.input
        url = input.get_url()
        assert url

        f = lindi.LindiH5pyFile.from_hdf5_file(url)

        # Load the spike data
        spike_times: np.ndarray = f['units/spike_times'][()]  # type: ignore
        spike_times_index: np.ndarray = f['units/spike_times_index'][()]  # type: ignore
        spike_trains = []
        offset = 0
        for i in range(len(spike_times_index)):
            st = spike_times[offset:int(spike_times_index[i])]
            # exclude the NaN from the spike times
            st = st[~np.isnan(st)]
            spike_trains.append(st)
            offset = int(spike_times_index[i])
        num_units = len(spike_trains)

        start_time_sec = float(0)  # we assume we are starting at time 0
        # end time is the max over all the spike trains
        all_spike_times = np.concatenate(spike_trains)
        end_time_sec = float(np.max(all_spike_times))

        print(f'Start time: {start_time_sec}')
        print(f'End time: {end_time_sec}')

        firing_rates_hz = [len(st) / (end_time_sec - start_time_sec) for st in spike_trains]

        print(f'Number of units: {num_units}')
        print(f'Total number of spikes: {sum([len(st) for st in spike_trains])}')
        for i in range(num_units):
            print(f'Unit {i}: {len(spike_trains[i])} spikes, {firing_rates_hz[i]:.2f} Hz')

        num_bins = int((end_time_sec - start_time_sec) / bin_size_sec)
        print(f'Number of bins: {num_bins}')

        # bin the spikes
        spike_counts = np.zeros((num_bins, num_units))
        for i in range(num_units):
            spike_counts[:, i], _ = np.histogram(spike_trains[i], bins=num_bins, range=(start_time_sec, end_time_sec))

        # Model setup
        def init_model():
            return cebra.CEBRA(  # type: ignore
                max_iterations=max_iterations,
                model_architecture="offset10-model",
                batch_size=batch_size,
                output_dimension=output_dimensions,
                temperature=1.0,
                distance='cosine',
                conditional='time_delta',
                time_offsets=time_offsets,
                verbose=True
                # There are many more parameters to explore. Head to
                # https://cebra.ai/docs/api/sklearn/cebra.html to explore them.
            )

        model = init_model()

        model.fit(
            spike_counts,
        )
        model = model.to(torch.device('cpu'))

        embedding = model.transform(spike_counts)

        cebra.plot_loss

        with open('cebra.h5', 'wb') as f:
            with h5py.File(f, 'w') as hf:
                hf.create_dataset('embedding', data=embedding)
                hf.attrs['batch_size'] = batch_size
                hf.attrs['bin_size_msec'] = bin_size_msec
                hf.attrs['max_iterations'] = max_iterations
                hf.attrs['output_dimensions'] = output_dimensions
                hf.attrs['num_units'] = num_units
                hf.attrs['num_bins'] = num_bins
                hf.attrs['start_time_sec'] = start_time_sec
                hf.attrs['end_time_sec'] = end_time_sec
                loss = model.state_dict_['loss']
                hf.create_dataset('loss', data=loss)

        context.output.upload('cebra.h5', delete_local_file=True)
