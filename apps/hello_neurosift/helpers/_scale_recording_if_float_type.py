import numpy as np
import spikeinterface as si
import spikeinterface.preprocessing as spre


def _scale_recording_if_float_type(recording: si.BaseRecording) -> si.BaseRecording:
    """
    The purpose of this function is to scale a float recording into a reasonable range
    so that whitening will work properly. The exact scaling factor doesn't matter. This
    is a workaround for this issue with whitening:
    https://github.com/SpikeInterface/spikeinterface/issues/2064
    """
    if np.dtype(recording.get_dtype()).kind == 'f': # floating point
        pass
    elif np.dtype(recording.get_dtype()).kind in ['u', 'i']: # integer
        return recording
    else:
        raise Exception(f'Unexpected recording dtype: {recording.get_dtype()}')

    print('Scaling float recording')

    # get the first 1000 samples
    traces0 = recording.get_traces(segment_index=0, start_frame=0, end_frame=1000)

    # get the median absolute value
    med_abs_val: float = np.median(np.abs(traces0)) # type: ignore
    if not med_abs_val:
        raise Exception('Median absolute value is zero')

    # scale the recording so that the median absolute value is 1
    recording_scaled = spre.scale(recording, gain=1 / med_abs_val)

    return recording_scaled