import os
from typing import List, Union
from ..common.api_requests import create_job
from ..common.dendro_types import DendroJobDefinition, DendroJobRequiredResources, DendroJobOutputFile
from ..common.DendroJob import SpecialJobOutput


def submit_job(
    *,
    service_name: str,
    job_definition: DendroJobDefinition,
    required_resources: DendroJobRequiredResources,
    target_compute_client_ids: Union[List[str], None] = None,
    tags: List[str] = [],
    skip_cache: bool = False,
    rerun_failing: bool = False,
    delete_failing: bool = False
):
    user_api_key = os.environ.get('DENDRO_API_KEY', None)
    if user_api_key is None:
        raise Exception('DENDRO_API_KEY environment variable must be set')
    job_dependencies = []

    # resolve the inputs that are job output file results
    for input_file in job_definition.inputFiles:
        if isinstance(input_file.url, SpecialJobOutput):
            special_job_output = input_file.url
        elif isinstance(input_file.url, DendroJobOutputFile):
            if not hasattr(input_file.url, '_special_job_output'):
                raise Exception(f'URL not set for input file {input_file.name}. If this is a job output file, you must submit the associated job first.')
            special_job_output = getattr(input_file.url, '_special_job_output')
        else:
            special_job_output = None
        if special_job_output:
            assert special_job_output.url
            input_file.url = special_job_output.url
            dependency_job_id = special_job_output.jobId
            if dependency_job_id not in job_dependencies:
                job_dependencies.append(dependency_job_id)

    if target_compute_client_ids is None:
        target_compute_client_ids = ['*']

    job = create_job(
        service_name=service_name,
        batch_id='',
        tags=tags,
        job_definition=job_definition,
        required_resources=required_resources,
        target_compute_client_ids=target_compute_client_ids,
        secrets=[],
        user_api_key=user_api_key,
        job_dependencies=job_dependencies,
        skip_cache=skip_cache,
        rerun_failing=rerun_failing,
        delete_failing=delete_failing
    )

    # Set attributes on the output files of the job
    for output_file in job_definition.outputFiles:
        special_job_output = job.get_output(output_file.name)
        if special_job_output:
            # In pydantic it seems that you can set an attribute that is not
            # defined in the model as long as it begins with an underscore. And
            # then it won't be included in .model_dump() or .dict() output. Try
            # this:
            # from pydantic import BaseModel
            # class M1(BaseModel):
            #     a: int
            #     b: str
            # m1 = M1(a=1, b='2')
            # setattr(m1, '_c', 3)
            # print(m1.model_dump())
            setattr(output_file, '_special_job_output', special_job_output)

    return job
