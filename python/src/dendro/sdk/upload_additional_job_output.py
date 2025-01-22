import os
import requests
from ..common.api_requests import get_upload_url


def upload_additional_job_output(
    local_file_name: str,
    remote_fname: str
):
    job_id = os.environ.get('JOB_ID', None)
    if job_id is None:
        raise Exception('JOB_ID environment variable is not set')
    job_private_key = os.environ.get('JOB_PRIVATE_KEY', None)
    if job_private_key is None:
        raise Exception('JOB_PRIVATE_KEY environment variable is not set')
    upload_url, download_url = get_upload_url(
        upload_type='other',
        job_id=job_id,
        job_private_key=job_private_key,
        output_name=None,
        other_name=remote_fname,
        size=os.path.getsize(local_file_name)
    )
    assert isinstance(upload_url, str)

    print(f'[] Uploading other file {remote_fname}') # it could be a security issue to provide the url in this print statement
    with open(local_file_name, 'rb') as f:
        resp_upload = requests.put(upload_url, data=f, timeout=60 * 60 * 24 * 7)
        if resp_upload.status_code != 200:
            print(upload_url)
            raise Exception(f'Error uploading other file to bucket ({resp_upload.status_code}) {resp_upload.reason}: {resp_upload.text}')

    return download_url
