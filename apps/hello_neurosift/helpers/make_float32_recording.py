import shutil
import os
import spikeinterface as si


def make_float32_recording(recording: si.BaseRecording, *, dirname: str) -> si.BinaryRecordingExtractor:
    return make_float32_or_int16_recording(recording, dirname=dirname, dtype_str='float32')


def make_int16_recording(recording: si.BaseRecording, *, dirname: str) -> si.BinaryRecordingExtractor:
    return make_float32_or_int16_recording(recording, dirname=dirname, dtype_str='int16')


def make_float32_or_int16_recording(recording: si.BaseRecording, *, dirname: str, dtype_str: str) -> si.BinaryRecordingExtractor:
    assert dtype_str in ('float32', 'int16')
    if os.path.exists(dirname):
        shutil.rmtree(dirname, ignore_errors=True)
    os.makedirs(dirname, exist_ok=True)
    fname = f'{dirname}/recording.dat'
    if recording.get_num_segments() != 1:
        raise NotImplementedError("Can only write recordings with a single segment")

    si.BinaryRecordingExtractor.write_recording(
        recording=recording,
        file_paths=[fname],
        dtype=dtype_str,
        n_jobs=1, # There may be some issues with parallelization (h5py and remfile, who knows)
        chunk_duration='20s', # this defaults to 1s which is inefficient for download
    )
    ret = si.BinaryRecordingExtractor(
        file_paths=[fname],
        sampling_frequency=recording.get_sampling_frequency(),
        channel_ids=recording.get_channel_ids(),
        num_chan=recording.get_num_channels(),
        dtype=dtype_str
    )
    ret.set_channel_locations(recording.get_channel_locations())
    return ret
