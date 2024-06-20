import os
from ..common.api_requests import create_job
from ..common.pairio_types import PairioJobDefinition, PairioJobRequiredResources


def submit_job(
    *,
    service_name: str,
    job_definition: PairioJobDefinition,
    required_resources: PairioJobRequiredResources
):
    user_api_key = os.environ.get('PAIRIO_API_KEY', None)
    if user_api_key is None:
        raise Exception('PAIRIO_API_KEY environment variable must be set')
    create_job(
        service_name=service_name,
        batch_id='',
        project_name='',
        job_definition=job_definition,
        required_resources=required_resources,
        secrets=[],
        user_api_key=user_api_key
    )
