import numpy as np
import lindi
from cebra_util import nwb_cebra, subsample_timeseries


# 000409/sub-CSHL045/sub-CSHL045_ses-46794e05-3f6a-4d35-afb3-9165091a5a74_behavior+ecephys+image.nwb
# https://neurosift.app/?p=/nwb&dandisetId=000409&dandisetVersion=draft&url=https://api.dandiarchive.org/api/assets/c04f6b30-82bf-40e1-9210-34f0bcd8be24/download/
url1 = 'https://api.dandiarchive.org/api/assets/c04f6b30-82bf-40e1-9210-34f0bcd8be24/download/'

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
    sec_to_remove_at_end = 15
    num_bins = num_bins - int(sec_to_remove_at_end * 1000 / bin_size_msec)
    embedding = embedding[:num_bins]
    start_time_sec = 10
    embedding = embedding[int(start_time_sec * 1000 / bin_size_msec):]
    num_bins = embedding.shape[0]

    timeseries_subsampled = subsample_timeseries(
        nwb_url=url1,
        timeseries_path='/processing/behavior/PoseEstimationBodyCamera/tail_start',
        bin_size_msec=bin_size_msec,
        num_bins=num_bins,
        start_time_sec=start_time_sec,
        local_cache=local_cache
    )
    r2 = linear_regression_r2(embedding, timeseries_subsampled)
    print(f'R^2: {r2}')


def linear_regression_r2(X: np.ndarray, y: np.ndarray) -> float:
    from sklearn.linear_model import LinearRegression
    reg = LinearRegression().fit(X, y)
    return reg.score(X, y)


if __name__ == '__main__':
    main()
