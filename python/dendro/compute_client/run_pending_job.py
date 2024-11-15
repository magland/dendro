from typing import Union
import os
from .start_compute_client import get_compute_client_daemon
from ..common.api_requests import get_runnable_job
from ..compute_client._start_job import _start_job


def run_pending_job(
    *,
    job_id: str,
    compute_client_dir: Union[str, None] = None,
    user_api_key: Union[str, None] = None,
    detach: bool = False
):
    CONTAINER_METHOD = os.environ.get("CONTAINER_METHOD")
    if not CONTAINER_METHOD:
        raise Exception("CONTAINER_METHOD environment variable must be set to either docker or apptainer")
    if compute_client_dir is not None:
        # Run as a compute client
        if user_api_key is not None:
            raise Exception("If compute_client_dir is provided, user_api_key must not be provided")
        daemon = get_compute_client_daemon(dir=compute_client_dir, exit_when_idle=False)
        daemon.run_pending_job(job_id=job_id, detach=detach)
    elif user_api_key is not None:
        # Run as just a user, not a compute client
        runnable_job = get_runnable_job(job_id=job_id, user_api_key=user_api_key)
        _start_job(job=runnable_job, compute_client_id='', detach=detach)
    else:
        raise Exception("Either compute_client_dir or user_api_key must be provided")
