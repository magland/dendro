import shutil
import os
import spikeinterface as si


def make_float32_recording(recording: si.BaseRecording, *, dirname: str) -> si.BinaryRecordingExtractor:
    if os.path.exists(dirname):
        shutil.rmtree(dirname)
    os.mkdir(dirname)
    fname = f'{dirname}/recording.dat'
    if recording.get_num_segments() != 1:
        raise NotImplementedError("Can only write recordings with a single segment")

    si.BinaryRecordingExtractor.write_recording(
        recording=recording,
        file_paths=[fname],
        dtype='float32',
        n_jobs=1, # There may be some issues with parallelization (h5py and remfile, who knows)
        chunk_duration='20s', # this defaults to 1s which is inefficient for download
    )
    ret = si.BinaryRecordingExtractor(
        file_paths=[fname],
        sampling_frequency=recording.get_sampling_frequency(),
        channel_ids=recording.get_channel_ids(),
        num_chan=recording.get_num_channels(),
        dtype='float32'
    )
    ret.set_channel_locations(recording.get_channel_locations())
    return ret
