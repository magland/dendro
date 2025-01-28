from dendro.sdk import ProcessorBase, InputFile, OutputFile
from pydantic import BaseModel, Field


class CebraNwbEmbedding6Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output NWB file in .nwb.lindi.tar format')
    units_path: str = Field(description='Path to the units table in the NWB file', default='units')
    max_iterations: int = Field(description='Maximum number of iterations', default=1000)
    batch_size: int = Field(description='Batch size', default=1000)
    bin_size_msec: float = Field(description='Bin size in milliseconds', default=20)
    output_dimensions: int = Field(description='Output dimensions', default=10)

class CebraNwbEmbedding6(ProcessorBase):
    name = 'cebra_nwb_embedding_6'
    description = 'Create a CEBRA embedding from a units table in an NWB file'
    label = 'cebra_nwb_embedding_6'
    image = 'magland/dendro-hello-cebra:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: CebraNwbEmbedding6Context
    ):
        import lindi
        import numpy as np
        import cebra
        import torch
        import pynwb
        from pynwb.file import ProcessingModule
        from pynwb.misc import TimeSeries
        from qfc.codecs import QFCCodec

        QFCCodec.register_codec()

        units_path = context.units_path
        batch_size = context.batch_size
        bin_size_msec = context.bin_size_msec
        max_iterations = context.max_iterations
        output_dimensions = context.output_dimensions

        bin_size_sec = bin_size_msec / 1000

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

        t = np.arange(num_bins) * bin_size_sec

        # Model setup
        def init_model():
            return cebra.CEBRA(  # type: ignore
                max_iterations=max_iterations,
                model_architecture="offset10-model",
                batch_size=batch_size,
                output_dimension=output_dimensions,
                temperature=1.0,
                distance='cosine',
                verbose=True,
                device='cuda_if_available'
                # There are many more parameters to explore. Head to
                # https://cebra.ai/docs/api/sklearn/cebra.html to explore them.
            )

        model = init_model()

        model.fit(
            spike_counts,
            t
        )
        if not torch.cuda.is_available():
            model = model.to(torch.device('cpu'))

        embedding = model.transform(spike_counts)

        print('Creating LINDI file')
        url = input.get_url()
        assert url, 'No URL for input file'
        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            with lindi.LindiH5pyFile.from_lindi_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        else:
            with lindi.LindiH5pyFile.from_hdf5_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')

        print('Opening LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar', mode="r+") as f:
            print('Reading NWB file')
            with pynwb.NWBHDF5IO(file=f, mode='a') as io:
                nwbfile = io.read()

                embedding_timeseries = TimeSeries(
                    name="embedding",
                    description="CEBRA embedding",
                    data=embedding,
                    starting_time=start_time_sec,
                    rate=1 / bin_size_sec,
                    unit='a.u.'
                )

                if 'CEBRA' not in nwbfile.processing:  # type: ignore
                    cebra_module = ProcessingModule(name='CEBRA', description='CEBRA embeddings')  # type: ignore
                    nwbfile.add_processing_module(cebra_module)  # type: ignore
                nwbfile.processing["CEBRA"].add(embedding_timeseries)  # type: ignore

                print('Writing NWB file')
                io.write(nwbfile)  # type: ignore

        print('Uploading output file')
        context.output.upload('output.nwb.lindi.tar')
