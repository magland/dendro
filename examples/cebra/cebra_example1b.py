import numpy as np
import lindi
from cebra_util import nwb_cebra, subsample_timeseries


# 000140/sub-Jenkins/sub-Jenkins_ses-small_desc-train_behavior+ecephys.nwb
# https://neurosift.app/?p=/nwb&dandisetId=000140&dandisetVersion=0.220113.0408&url=https://api.dandiarchive.org/api/assets/7821971e-c6a4-4568-8773-1bfa205c13f8/download/
url1 = 'https://api.dandiarchive.org/api/assets/7821971e-c6a4-4568-8773-1bfa205c13f8/download/'

def main():
    bin_size_msec = 50

    job = nwb_cebra(
        nwb_url=url1,
        max_iterations=10000,
        batch_size=1000,
        bin_size_msec=bin_size_msec,
        output_dimensions=10
    )

    embedding_h5_url = job.get_output('output').url
    local_cache = lindi.LocalCache(cache_dir='/tmp/lindi_cache')
    embedding_h5 = lindi.LindiH5pyFile.from_hdf5_file(
        embedding_h5_url,
        local_cache=local_cache
    )
    embedding: np.ndarray = embedding_h5['embedding'][()]  # type: ignore
    num_bins = embedding.shape[0]
    sec_to_remove_at_end = 5
    num_bins = num_bins - int(sec_to_remove_at_end * 1000 / bin_size_msec)
    embedding = embedding[:num_bins]

    cursor_pos_subsampled = subsample_timeseries(
        nwb_url=url1,
        timeseries_path='processing/behavior/cursor_pos',
        bin_size_msec=bin_size_msec,
        num_bins=num_bins,
        start_time_sec=0,
        local_cache=local_cache
    )
    r2 = linear_regression_r2(embedding, cursor_pos_subsampled)
    print(f'cursor_pos R^2: {r2}')

    finger_pos_subsampled = subsample_timeseries(
        nwb_url=url1,
        timeseries_path='processing/behavior/eye_pos',
        bin_size_msec=bin_size_msec,
        num_bins=num_bins,
        start_time_sec=0,
        local_cache=local_cache
    )
    r2 = linear_regression_r2(embedding, finger_pos_subsampled)
    print(f'eye_pos R^2: {r2}')

    finger_vel_subsampled = subsample_timeseries(
        nwb_url=url1,
        timeseries_path='processing/behavior/hand_pos',
        bin_size_msec=bin_size_msec,
        num_bins=num_bins,
        start_time_sec=0,
        local_cache=local_cache
    )
    r2 = linear_regression_r2(embedding, finger_vel_subsampled)
    print(f'hand_pos R^2: {r2}')

    target_pos_subsampled = subsample_timeseries(
        nwb_url=url1,
        timeseries_path='processing/behavior/hand_vel',
        bin_size_msec=bin_size_msec,
        num_bins=num_bins,
        start_time_sec=0,
        local_cache=local_cache
    )
    r2 = linear_regression_r2(embedding, target_pos_subsampled)
    print(f'hand_vel R^2: {r2}')


def linear_regression_r2(X: np.ndarray, y: np.ndarray) -> float:
    from sklearn.linear_model import LinearRegression
    reg = LinearRegression().fit(X, y)
    return reg.score(X, y)


if __name__ == '__main__':
    main()
