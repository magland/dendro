from typing import Union
import dandi.dandiarchive as da
import urllib.request
import urllib.error
import h5py
import lindi
from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources, PairioJobParameter, PairioJobInputFile, PairioJobOutputFile

def ephys_summary_batch(dandiset_id: str):
    parsed_url = da.parse_dandi_url(f"https://dandiarchive.org/dandiset/{dandiset_id}")
    num_consecutive_not_nwb = 0
    num_consecutive_not_found = 0
    num_assets_processed = 0
    statuses = []
    with parsed_url.navigate() as (client, dandiset, assets):
        assert dandiset
        for asset_obj in dandiset.get_assets('path'):
            if not asset_obj.path.endswith(".nwb"):
                num_consecutive_not_nwb += 1
                if num_consecutive_not_nwb >= 20:
                    # For example, this is important for 000026 because there are so many non-nwb assets
                    print("Stopping dandiset because too many consecutive non-NWB files.")
                    break
                continue
            else:
                num_consecutive_not_nwb = 0
            asset_id = asset_obj.identifier
            asset_path = asset_obj.path
            lindi_file_key = f'dandi/dandisets/{dandiset_id}/assets/{asset_id}/nwb.lindi.json'
            lindi_json_url = f'https://lindi.neurosift.org/{lindi_file_key}'
            if not _remote_file_exists(lindi_json_url):
                num_consecutive_not_found += 1
                continue
            else:
                num_consecutive_not_found = 0
            if num_consecutive_not_found >= 20:
                print(f'Stopping dandiset {dandiset_id} because too many consecutive not found files.')
                break
            tags = _get_tags_for_asset_path(asset_path)
            if 'ecephys' in tags:
                print(f"Processing {asset_path}")
                s = process_asset(lindi_json_url)
                statuses.extend(s)
                num_assets_processed += 1
                if num_assets_processed >= 30:
                    print(f'Stopping because {num_assets_processed} assets processed.')
                    break
    num_pending = len([s for s in statuses if s == 'pending'])
    num_failed = len([s for s in statuses if s == 'failed'])
    num_completed = len([s for s in statuses if s == 'completed'])
    num_running = len([s for s in statuses if s == 'running'])
    num_other = len(statuses) - num_pending - num_failed - num_completed - num_running
    print(f'num_pending: {num_pending}')
    print(f'num_failed: {num_failed}')
    print(f'num_completed: {num_completed}')
    print(f'num_running: {num_running}')
    print(f'num_other: {num_other}')


def process_asset(lindi_json_url: str):
    statuses = []
    hf = lindi.LindiH5pyFile.from_lindi_file(lindi_json_url)
    a = hf['/acquisition']
    assert isinstance(a, h5py.Group)
    for k in a.keys():
        g = a[k]
        if isinstance(g, h5py.Group):
            if g.attrs['neurodata_type'] == 'ElectricalSeries':
                rate = _get_sampling_rate_for_electrical_series(g)
                if rate is not None and rate >= 15000:
                    print(f'Processing ElectricalSeries {k} ({rate} Hz)')
                    status = process_electrical_series(lindi_json_url, 'acquisition/' + k)
                    statuses.append(status)
    return statuses


def process_electrical_series(lindi_json_url: str, electrical_series_path: str):
    service_name = 'hello_world_service'
    app_name = 'hello_neurosift'
    processor_name = 'ephys_summary_1'
    segment_start_time_sec = 0
    segment_duration_sec = 60
    tags = ['neurosift', 'EphysSummary']
    job_def = PairioJobDefinition(
        appName=app_name,
        processorName=processor_name,
        inputFiles=[
            PairioJobInputFile(
                name='input',
                fileBaseName='input.lindi.json',
                url=lindi_json_url
            )
        ],
        outputFiles=[
            PairioJobOutputFile(
                name='output',
                fileBaseName='ephys_summary.lindi.json'
            )
        ],
        parameters=[
            PairioJobParameter(
                name='electrical_series_path',
                value=electrical_series_path
            ),
            PairioJobParameter(
                name='segment_start_time_sec',
                value=segment_start_time_sec
            ),
            PairioJobParameter(
                name='segment_duration_sec',
                value=segment_duration_sec
            )
        ]
    )
    required_resources = PairioJobRequiredResources(
        numCpus=2,
        numGpus=0,
        memoryGb=4,
        timeSec=60 * 30
    )
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,
        required_resources=required_resources,
        tags=tags,
        rerun_failing=True
    )
    print(job.job_url, job.status)
    return job.status


def _get_sampling_rate_for_electrical_series(g: h5py.Group) -> Union[float, None]:
    if 'starting_time' in g.keys():
        st = g['starting_time']
        assert isinstance(st, h5py.Dataset)
        rate = st.attrs['rate']
        assert isinstance(rate, float) or isinstance(rate, int)
        return rate
    else:
        # TODO: support timestamps dataset and estimate rate from that
        return None


def _get_tags_for_asset_path(asset_path: str) -> list:
    # for example, with sub-ZYE-0031_ses-4_ecephys+image.nwb, return ['ecephys', 'image']
    # remove .nwb at end
    p = asset_path[:-len('.nwb')]
    last_part = p.split('_')[-1]  # get last part after _
    return last_part.split('+')


def _remote_file_exists(url: str) -> bool:
    # use a HEAD request to check if the file exists
    headers = {  # user-agent is required for some servers
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
    }
    req = urllib.request.Request(url, headers=headers, method="HEAD")
    try:
        with urllib.request.urlopen(req) as response:
            return response.getcode() == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        else:
            raise e


if __name__ == '__main__':
    dandiset_ids = ['000957', '000732']
    for dandiset_id in dandiset_ids:
        ephys_summary_batch(dandiset_id)
