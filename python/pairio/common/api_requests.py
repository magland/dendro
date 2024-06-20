import os
import requests
from typing import Union, Literal
from .pairio_types import PairioServiceApp
from .PairioJob import PairioJob

pairio_url = os.getenv('PAIRIO_URL', 'https://pairio.vercel.app')

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
    #   app: PairioServiceApp
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
    app = resp['app']
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
        'outputName': output_name,
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


def _post_api_request(*,
    url_path: str,
    data: dict,
    headers: Union[dict, None] = None
):
    assert url_path.startswith('/api')
    url = f'{pairio_url}{url_path}'
    try:
        resp = requests.post(url, headers=headers, json=data, timeout=60)
        resp.raise_for_status()
    except Exception as e:
        print(f'Error in client post api request for {url}; {e}')
        raise
    return resp.json()
