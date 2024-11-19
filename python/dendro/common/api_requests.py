import time
import os
import requests
from typing import Union, Literal
from typing import List
from .dendro_types import DendroServiceApp
from .DendroJob import DendroJob
from ..common.dendro_types import DendroJobDefinition, DendroJobRequiredResources, DendroJobSecret

dendro_api_url = os.getenv('DENDRO_API_URL', 'https://dendro.vercel.app')

def get_service_app(*,
    service_name: str,
    app_name: str
):
    # export type GetServiceAppRequest = {
    #   type: 'getServiceAppRequest'
    #   serviceName: string
    #   appName: string
    # }

    # export type GetServiceAppResponse = {
    #   type: 'getServiceAppResponse'
    #   serviceApp: DendroServiceApp
    # }

    req = {
        'type': 'getServiceAppRequest',
        'serviceName': service_name,
        'appName': app_name
    }
    resp = _post_api_request(
        url_path='/api/getServiceApp',
        data=req,
        headers={}
    )
    if resp['type'] != 'getServiceAppResponse':
        raise Exception('Unexpected response for getServiceAppRequest')
    app = resp['serviceApp']
    app = DendroServiceApp(**app)
    return app


def set_job_status(
    *,
    job_id: str,
    job_private_key: str,
    compute_client_id: str,
    status: str,
    error: Union[str, None]
):
    # export type SetJobStatusRequest = {
    #   type: 'setJobStatusRequest'
    #   jobId: string
    #   computeClientId: string
    #   status: DendroJobStatus
    #   error?: string
    # }
    req = {
        'type': 'setJobStatusRequest',
        'jobId': job_id,
        'computeClientId': compute_client_id,
        'status': status
    }
    if error is not None:
        req['error'] = error
    headers = {
        'Authorization': f'Bearer: {job_private_key}'
    }
    resp = _post_api_request(
        url_path='/api/setJobStatus',
        data=req,
        headers=headers
    )
    if resp['type'] != 'setJobStatusResponse':
        raise Exception('Unexpected response for setJobStatusRequest')


def get_runnable_jobs_for_compute_client(
    *,
    compute_client_id: str,
    compute_client_private_key: str,
    job_id: Union[str, None] = None,
    single_job: bool = False
):
    url_path = '/api/getRunnableJobsForComputeClient'
    req: dict = {
        'type': 'getRunnableJobsForComputeClientRequest',
        'computeClientId': compute_client_id
    }
    if job_id is not None:
        req['jobId'] = job_id
    if single_job:
        req['singleJob'] = True
    headers = {
        'Authorization': f'Bearer {compute_client_private_key}'
    }
    resp = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    runnable_jobs = resp['runnableJobs']
    runnable_jobs = [DendroJob(**job) for job in runnable_jobs]
    running_jobs = resp['runningJobs']
    running_jobs = [DendroJob(**job) for job in running_jobs]
    return runnable_jobs, running_jobs


def get_runnable_job(*, job_id: str, user_api_key: str):
    url_path = '/api/getRunnableJob'
    req = {
        'type': 'getRunnableJobRequest',
        'jobId': job_id
    }
    if job_id is not None:
        req['jobId'] = job_id
    headers = {
        'Authorization': f'Bearer {user_api_key}'
    }
    resp = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    runnable_job = resp['job']
    runnable_job = DendroJob(**runnable_job)
    return runnable_job


# // getJob
# export type GetJobRequest = {
#   type: 'getJobRequest'
#   jobId: string
#   includePrivateKey: boolean
#   computeClientId?: string
# }
#
# export type GetJobResponse = {
#   type: 'getJobResponse'
#   job?: DendroJob
# }

def get_job(*, job_id: str) -> Union[DendroJob, None]:
    """Get a job status from the dendro API"""
    url_path = '/api/getJob'
    req = {
        'type': 'getJobRequest',
        'jobId': job_id,
        'includePrivateKey': False
    }
    res = _post_api_request(
        url_path=url_path,
        data=req
    )
    job = res.get('job')
    if not job:
        return None
    job = DendroJob(**job)
    return job


def get_pubsub_subscription(*, compute_client_id: str, compute_client_private_key: str):
    url_path = '/api/getPubsubSubscription'
    req = {
        'type': 'getPubsubSubscriptionRequest',
        'computeClientId': compute_client_id,
        # 'protocolVersion': '1'  # don't use protocolVersion because ephemeri pubsub is not working!

    }
    headers = {
        'Authorization': f'Bearer {compute_client_private_key}'
    }
    resp = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    return resp['subscription']


def get_upload_url(*,
    job_id: str,
    job_private_key: str,
    upload_type: Literal['output', 'consoleOutput', 'resourceUtilizationLog', 'other'],
    output_name: Union[str, None],
    other_name: Union[str, None],
    size: int
):
    # // getSignedUploadUrl
    # export type GetSignedUploadUrlRequest = {
    #   type: 'getSignedUploadUrlRequest'
    #   jobId: string
    #   uploadType: 'output' | 'consoleOutput' | 'resourceUtilizationLog' | 'other'
    #   outputName?: string
    #   otherName?: string
    #   size: number
    # }
    #
    # export type GetSignedUploadUrlResponse = {
    #   type: 'getSignedUploadUrlResponse'
    #   signedUrl?: string
    #   parts?: {partNumber: number, signedUrl: string}[]
    #   uploadId?: string
    # }
    """Get a signed upload URL for the output (console or resource log) of a job"""
    url_path = '/api/getSignedUploadUrl'
    req = {
        'type': 'getSignedUploadUrlRequest',
        'jobId': job_id,
        'uploadType': upload_type,
        'size': size
    }
    if output_name is not None:
        req['outputName'] = output_name
    if other_name is not None:
        req['otherName'] = other_name
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'getSignedUploadUrlResponse':
        raise Exception('Unexpected response for getSignedUploadUrlRequest')
    if 'signedUrl' in res:
        return res['signedUrl'], res['downloadUrl']
    else:
        if 'parts' not in res:
            raise Exception('Unexpected response for getSignedUploadUrlRequest. Missing signedUrl and parts fields.')
        if 'uploadId' not in res:
            raise Exception('Unexpected response for getSignedUploadUrlRequest. Missing uploadId field.')
        return {
            'parts': res['parts'],
            'uploadId': res['uploadId']
        }, res['downloadUrl']

def finalize_multipart_upload(*,
    upload_id: str,
    parts: List[dict],
    job_id: str,
    job_private_key: str,
    url: str,
    size: int
):
    # // finalizeMultipartUpload

    # export type FinalizeMultipartUploadRequest = {
    #     type: 'finalizeMultipartUploadRequest'
    #     jobId: string
    #     url: string
    #     size: number
    #     uploadId: string
    #     parts: {
    #         PartNumber: number
    #         ETag: string
    #     }[]
    # }
    # export type FinalizeMultipartUploadResponse = {
    #    type: 'finalizeMultipartUploadResponse'
    # }
    url_path = '/api/finalizeMultipartUpload'
    req = {
        'type': 'finalizeMultipartUploadRequest',
        'jobId': job_id,
        'url': url,
        'size': size,
        'uploadId': upload_id,
        'parts': parts
    }
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'finalizeMultipartUploadResponse':
        raise Exception('Unexpected response for finalizeMultipartUploadRequest')


def cancel_multipart_upload(*,
    job_id: str,
    job_private_key: str,
    upload_id: str,
    url: str
):
    # export type CancelMultipartUploadRequest = {
    #   type: 'cancelMultipartUploadRequest'
    #   jobId: string
    #   url: string
    #   uploadId: string
    # }
    # export type CancelMultipartUploadResponse = {
    #   type: 'cancelMultipartUploadResponse'
    # }
    url_path = '/api/cancelMultipartUpload'
    req = {
        'type': 'cancelMultipartUploadRequest',
        'jobId': job_id,
        'url': url,
        'uploadId': upload_id
    }
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'cancelMultipartUploadResponse':
        raise Exception('Unexpected response for cancelMultipartUploadRequest')


def create_job(
    *,
    service_name: str,
    batch_id: str,
    tags: List[str],
    job_definition: DendroJobDefinition,
    required_resources: DendroJobRequiredResources,
    secrets: List[DendroJobSecret],
    user_api_key: str,
    target_compute_client_ids: Union[List[str], None] = None,
    job_dependencies: List[str] = [],
    skip_cache: bool = False,
    rerun_failing: bool = False,
    delete_failing: bool = False
):
    req = {
        'type': 'createJobRequest',
        'serviceName': service_name,
        'userId': '',  # determined from the api key
        'batchId': batch_id,
        'tags': tags,
        'jobDefinition': job_definition.model_dump(exclude_none=True),  # important to exclude none here for the cacheBust field
        'requiredResources': required_resources.model_dump(),
        'secrets': [s.model_dump() for s in secrets],
        'jobDependencies': job_dependencies,
        'skipCache': skip_cache,
        'rerunFailing': rerun_failing,
        'deleteFailing': delete_failing
    }
    if target_compute_client_ids is not None:
        req['targetComputeClientIds'] = target_compute_client_ids
    headers = {
        'Authorization': f'Bearer: {user_api_key}'
    }
    resp = _post_api_request(
        url_path='/api/createJob',
        data=req,
        headers=headers
    )
    if resp['type'] != 'createJobResponse':
        raise Exception('Unexpected response for createJobRequest')
    job = resp['job']
    job = DendroJob(**job)
    return job


def set_output_url(
    *,
    job_id: str,
    job_private_key: str,
    output_name: str,
    url: str
):
    url_path = '/api/setOutputFileUrl'
    req = {
        'type': 'setOutputFileUrlRequest',
        'jobId': job_id,
        'outputName': output_name,
        'url': url
    }
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'setOutputFileUrlResponse':
        raise Exception('Unexpected response for setOutputFileUrlRequest')


# For now, we can get the DANDI API key, but only in restricted
# circumstances. In the future the API key will remain secret on the
# server.
def api_get_dandi_api_key(*,
    job_id: str,
    job_private_key: str,
    output_name: str
):
    url_path = '/api/getDandiApiKey'
    req = {
        'type': 'getDandiApiKeyRequest',
        'jobId': job_id,
        'outputName': output_name
    }
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'getDandiApiKeyResponse':
        raise Exception('Unexpected response for getDandiApiKeyRequest')
    return res['dandiApiKey']


def _post_api_request(*,
    url_path: str,
    data: dict,
    headers: Union[dict, None] = None
) -> dict:
    num_retries = 4
    retry_delay = 1
    for i in range(num_retries):
        try:
            return _post_api_request_try(
                url_path=url_path,
                data=data,
                headers=headers
            )
        except Exception as e:
            if i == num_retries - 1:
                raise
            print(f'Error in client post api request for {url_path}; retrying in {retry_delay} seconds; {e}')
            time.sleep(retry_delay)
            retry_delay *= 2
    raise Exception('Impossible')


def _post_api_request_try(*,
    url_path: str,
    data: dict,
    headers: Union[dict, None] = None
) -> dict:
    assert url_path.startswith('/api')
    url = f'{dendro_api_url}{url_path}'
    try:
        resp = requests.post(url, headers=headers, json=data, timeout=60)
    except Exception as e:
        print(f'Error in client post api request for {url}; {e}')
        raise
    if resp.status_code != 200:
        raise Exception(f'Error in client post api request for {url}: {resp.status_code} {resp.reason}: {resp.text}')
    return resp.json()
