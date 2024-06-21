from pairio.sdk import App, ProcessorBase, BaseModel, Field, InputFile, OutputFile

app = App(
    app_name='hello_cebra',
    description='Example CEBRA processors'
)

class CebraNwbEmbedding1Context(BaseModel):
    input: InputFile = Field(description='Input NWB file')
    output: OutputFile = Field(description='Output embedding in .h5 format')
    max_iterations: int = Field(description='Maximum number of iterations', default=2000)
    batch_size: int = Field(description='Batch size', default=1000)
    bin_size_msec: float = Field(description='Bin size in milliseconds', default=50)
    output_dimensions: int = Field(description='Output dimensions', default=10)

class CebraNwbEmbedding1(ProcessorBase):
    name = 'cebra_nwb_embedding_1'
    description = 'Create a CEBRA embedding from a units table in an NWB file'
    label = 'cebra_nwb_embedding_1'
    image = 'magland/pairio-hello-cebra:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: CebraNwbEmbedding1Context
    ):
        import lindi
        import numpy as np
        import cebra
        import torch
        import h5py

        batch_size = context.batch_size
        bin_size_msec = context.bin_size_msec
        MAX_ITERATIONS = context.max_iterations
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
            spike_trains.append(spike_times[offset:int(spike_times_index[i])])
            offset = int(spike_times_index[i])
        num_units = len(spike_trains)

        start_time_sec = float(0)  # we assume we are starting at time 0
        end_time_sec = float(np.max(spike_times))

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
                # Our selected model will use 10 time bins (200ms) as its input
                model_architecture="offset10-model",

                # We will use mini-batches of size 1000 for optimization. You should
                # generally pick a number greater than 512, and larger values (if they
                # fit into memory) are generally better.
                batch_size=batch_size,

                # This is the number of steps to train. I ran an example with 10_000
                # which resulted in a usable embedding, but training longer might further
                # improve the results
                max_iterations=MAX_ITERATIONS,

                # This will be the number of output features. The optimal number depends
                # on the complexity of the dataset.
                output_dimension=output_dimensions,

                # If you want to see a progress bar during training, specify this
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

        with open('output.h5', 'wb') as f:
            with h5py.File(f, 'w') as hf:
                hf.create_dataset('embedding', data=embedding)

        context.output.upload('embedding.h5', delete_local_file=True)

app.add_processor(CebraNwbEmbedding1)

if __name__ == '__main__':
    app.run()
