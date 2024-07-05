import time
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile, upload_additional_job_output

class EphysSummary1Context(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.json format')
    output: OutputFile = Field(description='Output data in .lindi.json format')
    electrical_series_path: str = Field(description='Path to the electrical series object in the NWB file')
    segment_start_time_sec: float = Field(description='Start time of segment to analyze in seconds')
    segment_duration_sec: float = Field(description='Duration of segment to analyze in seconds')


class EphysSummary1(ProcessorBase):
    name = 'ephys_summary_1'
    description = 'Compute summary information for an electrophysiology dataset'
    label = 'ephys_summary_1'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: EphysSummary1Context
    ):
        import lindi
        import h5py
        from nwbextractors import NwbRecordingExtractor
        import spikeinterface.preprocessing as spre

        electrical_series_path = context.electrical_series_path
        start_time_sec = context.segment_start_time_sec
        duration_sec = context.segment_duration_sec

        input = context.input
        url = input.get_url()
        assert url

        print('Loading file')
        if input.file_base_name.endswith('.lindi.json'):
            local_cache = lindi.LocalCache(cache_dir='lindi_cache')
            f = lindi.LindiH5pyFile.from_lindi_file(url, local_cache=local_cache)
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url)

        print('Gathering file information')
        g = f[electrical_series_path]
        assert isinstance(g, h5py.Group)
        ndt = g.attrs['neurodata_type']
        if ndt != 'ElectricalSeries':
            raise Exception(f'Invalid neurodata_type for electrical series object: {ndt} != ElectricalSeries')

        print('Loading recording')
        recording = NwbRecordingExtractor(h5py_file=f, electrical_series_path=electrical_series_path)

        print('Extracting segment to analyze')
        recording = recording.frame_slice(start_frame=int(start_time_sec * recording.get_sampling_frequency()), end_frame=int((start_time_sec + duration_sec) * recording.get_sampling_frequency()))

        print('Filtering recording')
        recording = spre.bandpass_filter(recording, freq_min=300, freq_max=6000)

        print('Getting channel ids')
        channel_ids = recording.get_channel_ids()

        print('Estimating channel firing rates')
        estimated_channel_firing_rates = compute_estimated_channel_firing_rates(recording)

        print('Saving output')
        with open('ephys_summary.h5', 'wb') as f:
            with h5py.File(f, 'w') as hf:
                hf.attrs['channel_ids'] = [str(ch) for ch in channel_ids]
                hf.create_dataset('estimated_channel_firing_rates', data=estimated_channel_firing_rates)

        print('Uploading output')
        upload_h5_as_lindi_output(
            h5_fname='ephys_summary.h5',
            output=context.output
        )

def compute_estimated_channel_firing_rates(recording):
    import numpy as np
    import spikeinterface as si
    timestamp_last_print = time.time()
    R: si.BaseRecording = recording
    chunk_duration_sec = 5
    num_chunks = int(R.get_num_frames() / R.get_sampling_frequency() / chunk_duration_sec)
    X = np.zeros((num_chunks, R.get_num_channels()))
    for ss in range(num_chunks):
        elapsed_since_last_print = time.time() - timestamp_last_print
        if elapsed_since_last_print > 10:
            print(f'Computing estimated channel firing rates: {ss} of {num_chunks} time chunks')
            timestamp_last_print = time.time()
        traces = R.get_traces(start_frame=int(ss * chunk_duration_sec * R.get_sampling_frequency()), end_frame=int((ss + 1) * chunk_duration_sec * R.get_sampling_frequency()))
        for m in range(R.get_num_channels()):
            X[ss, m] = estimate_num_spikes(traces[:, m]) / chunk_duration_sec
    return np.mean(X, axis=0)

def estimate_num_spikes(trace):
    import numpy as np
    X: np.ndarray = trace
    # normalize
    X = X - np.mean(X)
    X = X / np.std(X)
    detect_threshold = 5
    candidate_times = np.where(X < -detect_threshold)[0]  # assume spikes are negative
    detect_interval = 20
    # don't double count times that are within detect_interval of each other
    times = []
    last_detect_time = -1000
    for t in candidate_times:
        if t - last_detect_time > detect_interval:
            times.append(t)
            last_detect_time = t
    return len(times)

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
