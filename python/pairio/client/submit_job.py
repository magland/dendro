import os
from typing import List
from ..common.api_requests import create_job
from ..common.pairio_types import PairioJobDefinition, PairioJobRequiredResources
from ..common.PairioJob import SpecialJobOutput


def submit_job(
    *,
    service_name: str,
    job_definition: PairioJobDefinition,
    required_resources: PairioJobRequiredResources,
    tags: List[str] = [],
    skip_cache: bool = False,
    rerun_failing: bool = False,
    delete_failing: bool = False
):
    user_api_key = os.environ.get('PAIRIO_API_KEY', None)
    if user_api_key is None:
        raise Exception('PAIRIO_API_KEY environment variable must be set')
    job_dependencies = []
    # resolve the inputs that are job output file results
    for input_file in job_definition.inputFiles:
        if isinstance(input_file.url, SpecialJobOutput):
            oo = input_file.url
            assert oo.url
            input_file.url = oo.url
            dependency_job_id = oo.jobId
            if dependency_job_id not in job_dependencies:
                job_dependencies.append(dependency_job_id)

    job = create_job(
        service_name=service_name,
        batch_id='',
        tags=tags,
        job_definition=job_definition,
        required_resources=required_resources,
        secrets=[],
        user_api_key=user_api_key,
        job_dependencies=job_dependencies,
        skip_cache=skip_cache,
        rerun_failing=rerun_failing,
        delete_failing=delete_failing
    )
    return job
