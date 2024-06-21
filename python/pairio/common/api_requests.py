import os
import requests
from typing import Union, Literal
from typing import List
from .pairio_types import PairioServiceApp
from .PairioJob import PairioJob
from ..common.pairio_types import PairioJobDefinition, PairioJobRequiredResources, PairioJobSecret

pairio_api_url = os.getenv('PAIRIO_API_URL', 'https://pairio.vercel.app')

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
    #   serviceApp: PairioServiceApp
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
    app = PairioServiceApp(**app)
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
    #   status: PairioJobStatus
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


def get_jobs(
    *,
    compute_client_id: str,
    compute_client_private_key: str
):
    url_path = '/api/getJobsForComputeClient'
    req = {
        'type': 'getJobsForComputeClientRequest',
        'computeClientId': compute_client_id
    }
    headers = {
        'Authorization': f'Bearer {compute_client_private_key}'
    }
    resp = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    jobs = resp['jobs']
    jobs = [PairioJob(**job) for job in jobs]
    return jobs


def get_runnable_jobs_for_compute_client(
    *,
    compute_client_id: str,
    compute_client_private_key
):
    url_path = '/api/getRunnableJobsForComputeClient'
    req = {
        'type': 'getRunnableJobsForComputeClientRequest',
        'computeClientId': compute_client_id
    }
    headers = {
        'Authorization': f'Bearer {compute_client_private_key}'
    }
    resp = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    runnable_jobs = resp['runnableJobs']
    runnable_jobs = [PairioJob(**job) for job in runnable_jobs]
    running_jobs = resp['runningJobs']
    running_jobs = [PairioJob(**job) for job in running_jobs]
    return runnable_jobs, running_jobs


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
#   job: PairioJob
# }

def get_job(*, job_id: str) -> PairioJob:
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
    job = res['job']
    job = PairioJob(**job)
    return job


def get_pubsub_subscription(*, compute_client_id: str, compute_client_private_key: str):
    url_path = '/api/getPubsubSubscription'
    req = {
        'type': 'getPubsubSubscriptionRequest',
        'computeClientId': compute_client_id
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
) -> str:
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
    #   signedUrl: string
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
    return res['signedUrl']


def create_job(
    *,
    service_name: str,
    batch_id: str,
    tags: List[str],
    job_definition: PairioJobDefinition,
    required_resources: PairioJobRequiredResources,
    secrets: List[PairioJobSecret],
    user_api_key: str,
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
    job = PairioJob(**job)
    return job


def _post_api_request(*,
    url_path: str,
    data: dict,
    headers: Union[dict, None] = None
):
    assert url_path.startswith('/api')
    url = f'{pairio_api_url}{url_path}'
    try:
        resp = requests.post(url, headers=headers, json=data, timeout=60)
    except Exception as e:
        print(f'Error in client post api request for {url}; {e}')
        raise
    if resp.status_code != 200:
        raise Exception(f'Error in client post api request for {url}: {resp.status_code} {resp.reason}: {resp.text}')
    return resp.json()
