import uuid
from dendro.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class TuningAnalysis000363Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output NWB file in .nwb.lindi.tar format')
    units_path: str = Field(description='Path to the units table in the NWB file', default='units')
    position_path: str = Field(description='Path to the position timeseries in the NWB file')
    output_phase_path: str = Field(description='Path to the output phase timeseries in the NWB file')

class TuningAnalysis000363(ProcessorBase):
    name = 'tuning_analysis_000363'
    description = 'Special analysis for 000363 Dandiset'
    label = 'tuning_analysis_000363'
    image = 'magland/dendro-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: TuningAnalysis000363Context
    ):
        import lindi
        import numpy as np
        from qfc.codecs import QFCCodec
        from .behavior_signal_processing import BehaviorFun, FilterFun, Utils

        QFCCodec.register_codec()

        units_path = context.units_path
        position_path = context.position_path
        output_phase_path = context.output_phase_path

        input = context.input
        url = input.get_url()
        assert url

        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            f = lindi.LindiH5pyFile.from_lindi_file(url)
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url)

        position_grp = f[position_path]
        assert isinstance(position_grp, lindi.LindiH5pyGroup)
        position_data = position_grp['data'][()]
        position_timestamps = position_grp['timestamps'][()]

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

        print(f'Number of units: {num_units}')
        print(f'Total number of spikes: {sum([len(st) for st in spike_trains])}')

        print('Creating LINDI file')
        url = input.get_url()
        assert url, 'No URL for input file'
        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            with lindi.LindiH5pyFile.from_lindi_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')
        else:
            with lindi.LindiH5pyFile.from_hdf5_file(url) as f:
                f.write_lindi_file('output.nwb.lindi.tar')

        print('Computing phase')
        estimated_sample_rate = 1 / np.median(np.diff(position_timestamps))

        # behavior trace - keep only one channel
        behavior_trace = position_data[:, 1]  # type: ignore

        # [optional but recommended] Bandpass filter the data
        # TODO: expose this as a parameter
        signal_class = 'jaw_movement'
        settings = BehaviorFun.signal_settings.get(signal_class, BehaviorFun.signal_settings['default'])
        band_pass_cutoffs = settings['band_pass_cutoffs']
        filtered_trace = FilterFun.filter_signal(behavior_trace, sampling_rate=estimated_sample_rate, filter_option=['bandpass', band_pass_cutoffs])

        # [optional but recommended] Detect movement periods
        movement_mask = Utils.detect_movement_periods(filtered_trace, timestamps=position_timestamps)[0]

        # Compute phase
        phase = BehaviorFun.compute_phase_for_movement(filtered_trace, sample_rate=estimated_sample_rate, movement_mask=movement_mask)[0]
        phase = np.real(phase).astype(np.float32)

        ts_masked = position_timestamps[~np.isnan(phase)]
        phase_masked = phase[~np.isnan(phase)]

        print('Writing to output LINDI file')
        with lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar', mode="r+") as f:
            g = f.create_group(output_phase_path)
            g.attrs['description'] = 'Phase timeseries'
            g.attrs['comments'] = 'no comments'
            g.attrs['namespace'] = 'core'
            g.attrs['neurodata_type'] = 'TimeSeries'
            g.attrs['object_id'] = str(uuid.uuid4())
            x_d = g.create_dataset('data', data=phase_masked)
            x_d.attrs['conversion'] = 1
            x_d.attrs['offset'] = 0
            x_d.attrs['resolution'] = -1
            x_d.attrs['unit'] = 'a.u.'
            x_ts = g.create_dataset('timestamps', data=ts_masked)
            x_ts.attrs['interval'] = 1
            x_ts.attrs['unit'] = 'seconds'

        print('Uploading output file')
        context.output.upload('output.nwb.lindi.tar')
