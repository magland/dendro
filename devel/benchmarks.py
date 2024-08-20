import shutil
import os
import sys
import urllib.request
import time
import lindi
import numpy as np
from helpers.nwbextractors import NwbRecordingExtractor
from helpers.make_float32_recording import make_float32_recording
import spikeinterface.preprocessing as spre
from qfc.codecs import QFCCodec

QFCCodec.register_codec()


url1 = 'https://api.dandiarchive.org/api/assets/c04f6b30-82bf-40e1-9210-34f0bcd8be24/download/'

# QFC compressed with compression ration 12
url2 = 'https://tempory.net/f/pairio/f/hello_world_service/hello_neurosift/prepare_ephys_spike_sorting_dataset/RRtLoqV38HNCukjyYzSw/output/pre.nwb.lindi.tar'

def benchmark_download_100mb():
    # Downloading 100 MB of data
    with TimeIt(label='Download 100 MB') as tt:
        num_bytes = 100_000_000
        download_data(url1, num_bytes)
        elapsed_sec = tt.elapsed()
        rate = num_bytes / elapsed_sec
        print(f'Rate: {rate / 1_000_000:.2f} MB/s')


def benchmark_download_1gb():
    # Downloading 1 GB of data
    with TimeIt(label='Download 1 GB') as tt:
        num_bytes = 1_000_000_000
        download_data(url1, num_bytes)
        elapsed_sec = tt.elapsed()
        rate = num_bytes / elapsed_sec
        print(f'Rate: {rate / 1_000_000:.2f} MB/s')


def benchmark_load_ephys_from_nwb():
    # Load ephys from remote NWB file
    with TimeIt(label='Load ephys from NWB'):
        f = lindi.LindiH5pyFile.from_hdf5_file(url1)
        d = f['acquisition/ElectricalSeriesAp/data']
        assert isinstance(d, lindi.LindiH5pyDataset)
        print(d.shape)
        x = d[0:30000 * 60]
        assert isinstance(x, np.ndarray)
        print(x.shape)


def benchmark_write_float32_recording():
    # Write float32 recording - from remote NWB file
    with TimeIt(label='Write float32 recording'):
        channel_index_range = [101, 165]
        num_timepoints = 30000 * 60
        f = lindi.LindiH5pyFile.from_hdf5_file(url1)
        recording = NwbRecordingExtractor(
            h5py_file=f,
            electrical_series_path='acquisition/ElectricalSeriesAp'
        )
        all_channel_ids = recording.get_channel_ids()
        channel_ids = all_channel_ids[channel_index_range[0]:channel_index_range[1]]
        recording = recording.frame_slice(start_frame=0, end_frame=num_timepoints)
        recording = recording.channel_slice(channel_ids=channel_ids)
        if os.path.exists('float32_recording'):
            shutil.rmtree('float32_recording')
        make_float32_recording(
            recording=recording,
            dirname='float32_recording'
        )


def benchmark_write_filtered_recording():
    # Write filtered recording - from remote NWB file
    with TimeIt(label='Write filtered recording'):
        channel_index_range = [101, 165]
        num_timepoints = 30000 * 60
        f = lindi.LindiH5pyFile.from_hdf5_file(url1)
        recording = NwbRecordingExtractor(
            h5py_file=f,
            electrical_series_path='acquisition/ElectricalSeriesAp'
        )
        all_channel_ids = recording.get_channel_ids()
        channel_ids = all_channel_ids[channel_index_range[0]:channel_index_range[1]]
        recording = recording.frame_slice(start_frame=0, end_frame=num_timepoints)
        recording = recording.channel_slice(channel_ids=channel_ids)
        freq_min = 300
        freq_max = 6000
        recording_filtered = spre.bandpass_filter(
            recording, freq_min=freq_min, freq_max=freq_max, dtype=np.float32
        )  # important to specify dtype here
        if os.path.exists('filtered_recording'):
            shutil.rmtree('filtered_recording')
        make_float32_recording(
            recording=recording_filtered,
            dirname='filtered_recording'
        )


def benchmark_write_filtered_recording_2():
    with TimeIt(label='Write filtered recording 2'):
        print('Creating LINDI file from NWB file')
        if os.path.exists('output.nwb.lindi.tar'):
            os.remove('output.nwb.lindi.tar')
        with lindi.LindiH5pyFile.from_hdf5_file(url1) as f:
            f.write_lindi_file('output.nwb.lindi.tar')
        channel_index_range = [101, 165]
        num_timepoints = 30000 * 60
        f = lindi.LindiH5pyFile.from_lindi_file('output.nwb.lindi.tar')
        recording = NwbRecordingExtractor(
            h5py_file=f,
            electrical_series_path='acquisition/ElectricalSeriesAp'
        )
        all_channel_ids = recording.get_channel_ids()
        channel_ids = all_channel_ids[channel_index_range[0]:channel_index_range[1]]
        recording = recording.frame_slice(start_frame=0, end_frame=num_timepoints)
        recording = recording.channel_slice(channel_ids=channel_ids)
        freq_min = 300
        freq_max = 6000
        recording_filtered = spre.bandpass_filter(
            recording, freq_min=freq_min, freq_max=freq_max, dtype=np.float32
        )  # important to specify dtype here
        if os.path.exists('filtered_recording'):
            shutil.rmtree('filtered_recording')
        make_float32_recording(
            recording=recording_filtered,
            dirname='filtered_recording'
        )


def benchmark_write_float32_recording_from_qfc_nwb():
    # Write float32 recording - from remote NWB file - qfc compressed
    with TimeIt(label='Write float32 recording - qfc compressed'):
        num_timepoints = 30000 * 60
        f = lindi.LindiH5pyFile.from_lindi_file(url2)
        recording = NwbRecordingExtractor(
            h5py_file=f,
            electrical_series_path='acquisition/ElectricalSeriesAp_pre'
        )
        recording = recording.frame_slice(start_frame=0, end_frame=num_timepoints)
        if os.path.exists('float32_recording'):
            shutil.rmtree('float32_recording')
        make_float32_recording(
            recording=recording,
            dirname='float32_recording'
        )


def download_data(url, num_bytes):
    headers = {'Range': f'bytes=0-{num_bytes - 1}'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        response.read()


class TimeIt:
    def __init__(self, label):
        self.label = label

    def __enter__(self):
        print(f'Starting {self.label}')
        self.start = time.time()
        return self

    def __exit__(self, *args):
        print(f'{self.label}: {time.time() - self.start:.2f} seconds')

    def elapsed(self):
        return time.time() - self.start


benchmarks = [
    ('download_100mb', benchmark_download_100mb),
    ('download_1gb', benchmark_download_1gb),
    ('load_ephys_from_nwb', benchmark_load_ephys_from_nwb),
    ('write_float32_recording', benchmark_write_float32_recording),
    ('write_filtered_recording', benchmark_write_filtered_recording),
    ('write_filtered_recording_2', benchmark_write_filtered_recording_2),
    ('write_float32_recording_from_qfc_nwb', benchmark_write_float32_recording_from_qfc_nwb),
]

if __name__ == '__main__':
    # get first command line argument
    if len(sys.argv) < 2:
        print('Usage:')
        for name, _ in benchmarks:
            print(f'  python benchmarks.py {name}')
        sys.exit(1)
    benchmark_name = sys.argv[1]
    for name, benchmark in benchmarks:
        if name == benchmark_name:
            benchmark()
            break
    else:
        print(f'Unknown benchmark: {benchmark_name}')
        sys.exit(1)
