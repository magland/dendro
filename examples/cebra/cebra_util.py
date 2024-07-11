import os
import numpy as np
import lindi
from pairio.client import submit_job, PairioJobRequiredResources, PairioJobDefinition, PairioJobInputFile, PairioJobOutputFile, PairioJobParameter


def nwb_cebra(
    *,
    nwb_url: str,
    max_iterations: int = 2000,
    batch_size: int = 1000,
    bin_size_msec: int = 50,
    output_dimensions: int = 10,
    required_resources: PairioJobRequiredResources = PairioJobRequiredResources(
        numCpus=4,
        numGpus=0,
        memoryGb=8,
        timeSec=60 * 50
    )
):
    if not os.getenv('PAIRIO_API_KEY'):
        raise Exception('PAIRIO_API_KEY environment variable must be set')
    service_name = os.getenv('PAIRIO_SERVICE_NAME', 'hello_world_service')
    job_def = PairioJobDefinition(
        appName='hello_cebra',
        processorName='cebra_nwb_embedding_5',
        inputFiles=[
            PairioJobInputFile(
                name='input',
                fileBaseName='input.nwb',
                url=nwb_url
            )
        ],
        outputFiles=[
            PairioJobOutputFile(
                name='output',
                fileBaseName='embedding.h5'
            )
        ],
        parameters=[
            PairioJobParameter(
                name='max_iterations',
                value=max_iterations
            ),
            PairioJobParameter(
                name='batch_size',
                value=batch_size
            ),
            PairioJobParameter(
                name='bin_size_msec',
                value=bin_size_msec
            ),
            PairioJobParameter(
                name='output_dimensions',
                value=output_dimensions
            )
        ]
    )
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,

        required_resources=required_resources,
        tags=['example', 'cebra'],
        rerun_failing=True
    )
    job.wait_until_done()
    return job


def subsample_timeseries(
    nwb_url: str,
    timeseries_path: str,
    bin_size_msec: int,
    num_bins: int,
    start_time_sec: float,
    local_cache: lindi.LocalCache
):
    f = lindi.LindiH5pyFile.from_hdf5_file(
        nwb_url,
        local_cache=local_cache
    )

    # Load the cursor position data
    timeseries_group = f[timeseries_path]

    data = timeseries_group['data'][()]  # type: ignore
    assert isinstance(data, np.ndarray)
    if data.ndim == 1:
        data = data[:, np.newaxis]

    if 'starting_time' in timeseries_group.keys():
        starting_time = timeseries_group['starting_time'][()]
        rate = timeseries_group['starting_time'].attrs['rate']
        timestamps = starting_time + np.arange(data.shape[0]) / rate
    elif 'timestamps' in timeseries_group.keys():
        timestamps = timeseries_group['timestamps'][()]
    else:
        raise Exception('No starting_time or timestamps found in timeseries group')

    min_timestamp = timestamps[0]
    max_timestamp = timestamps[-1]
    if min_timestamp > start_time_sec:
        raise Exception(f'min_timestamp {min_timestamp} is greater than 0')
    if max_timestamp < num_bins * bin_size_msec / 1000:
        raise Exception(f'max_timestamp {max_timestamp} is less than num_bins * bin_size_msec / 1000 = {num_bins * bin_size_msec / 1000}')
    ind = 0
    data_subsampled = np.zeros((num_bins, data.shape[1]))
    for i in range(num_bins):
        t = i * bin_size_msec / 1000
        while ind < len(timestamps) - 1 and timestamps[ind] < t:
            ind = ind + 1
        data_subsampled[i, :] = data[ind, :]

    data_subsampled = fill_nans(data_subsampled)

    return data_subsampled

def fill_nans(x: np.ndarray) -> np.ndarray:
    ret = x.copy()
    for j in range(x.shape[1]):
        last_valid_value = 0
        for i in range(x.shape[0]):
            if np.isnan(x[i, j]):
                ret[i, j] = last_valid_value
            else:
                last_valid_value = x[i, j]
    return ret