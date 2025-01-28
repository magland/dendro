import numpy as np
from pydantic import BaseModel, Field
from dendro.sdk import ProcessorBase, InputFile, OutputFile


class TsDownsampleForVisContext(BaseModel):
    input: InputFile = Field(description='Input NWB file in .nwb or .nwb.lindi.tar format')
    output: OutputFile = Field(description='Output data in .lindi.tar format')


class TsDownsampleForVis(ProcessorBase):
    name = 'ts_downsample_for_vis'
    description = 'Multiscale downsampling of large time series data for visualization'
    label = 'ts_downsample_for_vis'
    image = 'magland/dendro-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: TsDownsampleForVisContext
    ):
        import lindi

        input = context.input
        url = input.get_url()
        assert url

        # Important: use of local cache causes severe slowdowns on dandihub
        # cache = lindi.LocalCache(cache_dir='lindi_cache')
        local_cache = None

        print('Loading file')
        if input.file_base_name.endswith('.lindi.json') or input.file_base_name.endswith('.lindi.tar'):
            f = lindi.LindiH5pyFile.from_lindi_file(url, local_cache=local_cache)
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url, local_cache=local_cache)

        output_fname = 'output.lindi.tar'
        f.write_lindi_file(output_fname)
        f.close()

        f = lindi.LindiH5pyFile.from_lindi_file(output_fname, local_cache=local_cache, mode='r+')
        handle_multiscale_downsampling(f)
        f.close()

        context.output.upload(output_fname)


def handle_multiscale_downsampling(f, group_path='/'):
    import lindi
    grp = f[group_path]
    if 'data' in grp:
        if 'timestamps' in grp or 'start_time' in grp:
            print(f'Timeseries {group_path}')
            handle_multiscale_downsampling_dataset(f, _join(group_path, 'data'))
            return
    for key in f[group_path].keys():
        path2 = _join(group_path, key)
        if isinstance(f[group_path + key], lindi.LindiH5pyGroup):
            handle_multiscale_downsampling(f, path2)

def _join(a: str, b: str):
    if a.endswith('/'):
        return a + b
    else:
        return a + '/' + b


def handle_multiscale_downsampling_dataset(f, path: str):
    import lindi
    import numpy as np
    f2: lindi.LindiH5pyFile = f
    ds = f2[path]
    assert isinstance(ds, lindi.LindiH5pyDataset)

    chunk_size_mb = 8
    chunk_size_bytes = chunk_size_mb * 1000 * 1000
    shape = ds.shape
    dtype = np.dtype(ds.dtype)
    bytes_per_element = dtype.itemsize

    if len(shape) == 0:
        return
    elif len(shape) == 1:
        N1 = shape[0]
        N2 = 1
    elif len(shape) == 2:
        N1 = shape[0]
        N2 = shape[1]
    else:
        return
    chunk_num_timepoints = int(chunk_size_bytes / bytes_per_element / N2)
    if chunk_num_timepoints < 1:
        return
    input_path = path
    input_ds_factor = 1
    output_ds_factor = 9
    while True:
        ds_num_timepoints = N1 // input_ds_factor
        if ds_num_timepoints < chunk_num_timepoints:
            break
        output_path = path + f'_ds_{output_ds_factor}'
        print(f'Creating dataset: {output_path}')
        handle_multiscale_downsampling_dataset_2d(
            f=f,
            input_path=input_path,
            input_ds_factor=input_ds_factor,
            output_path=output_path,
            output_ds_factor=output_ds_factor,
            chunk_num_timepoints=chunk_num_timepoints
        )
        input_path = output_path
        input_ds_factor = output_ds_factor
        output_ds_factor = output_ds_factor * 3


def handle_multiscale_downsampling_dataset_2d(
    f,
    input_path: str,
    input_ds_factor: int,
    output_path: str,
    output_ds_factor: int,
    chunk_num_timepoints: int
):
    import lindi
    f2: lindi.LindiH5pyFile = f
    input_dataset = f2[input_path]
    assert isinstance(input_dataset, lindi.LindiH5pyDataset)

    dtype = input_dataset.dtype
    num_channels = input_dataset.shape[1] if len(input_dataset.shape) > 1 else 1
    num_input_timepoints = input_dataset.shape[0] if len(input_dataset.shape) > 0 else 1
    relative_ds_factor = output_ds_factor // input_ds_factor
    if input_ds_factor * relative_ds_factor != output_ds_factor:
        raise Exception(f'Unexpected: input_ds_factor * relative_ds_factor != output_ds_factor :: {input_ds_factor} * {relative_ds_factor} != {output_ds_factor}')
    num_output_timepoints = num_input_timepoints // relative_ds_factor  # note that we round down, but that's okay for visualization (I think)

    output_shape = (num_output_timepoints, num_channels, 2)  # 2 is for the min and max

    chunk_shape = (chunk_num_timepoints, num_channels)
    output_dataset = f2.create_dataset(output_path, dtype=dtype, shape=output_shape, chunks=chunk_shape)

    # we need to round up for the number of chunks
    num_chunks = (num_output_timepoints + chunk_num_timepoints - 1) // chunk_num_timepoints

    input_has_min_max = len(input_dataset.shape) == 3 and input_dataset.shape[2] == 2

    for ii in range(num_chunks):
        print(f'Processing chunk {ii + 1} of {num_chunks}')
        output_start = ii * chunk_num_timepoints
        output_end = min((ii + 1) * chunk_num_timepoints, num_output_timepoints)
        input_start = output_start * relative_ds_factor
        input_end = output_end * relative_ds_factor
        input_data = np.array(input_dataset[input_start:input_end])
        if input_has_min_max:
            input_data_min = np.min(input_data[:, :, 0].reshape(output_end - output_start, num_channels), axis=1)
            input_data_max = np.max(input_data[:, :, 1].reshape(output_end - output_start, num_channels), axis=1)
            output_data = np.zeros((output_end - output_start, num_channels, 2), dtype=dtype)
            output_data[:, :, 0] = input_data_min
            output_data[:, :, 1] = input_data_max
            output_dataset[output_start:output_end] = output_data
        else:
            input_data_reshaped = input_data.reshape(output_start - output_end, relative_ds_factor, num_channels)
            output_data_min = np.min(input_data_reshaped, axis=1).reshape(output_end - output_start, num_channels)
            output_data_max = np.max(input_data_reshaped, axis=1).reshape(output_end - output_start, num_channels)
            output_data = np.zeros((output_end - output_start, num_channels, 2), dtype=dtype)
            output_data[:, :, 0] = output_data_min
            output_data[:, :, 1] = output_data_max
            output_dataset[output_start:output_end] = output_data
