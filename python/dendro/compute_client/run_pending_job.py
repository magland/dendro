import os
from .start_compute_client import get_compute_client_daemon


def run_pending_job(
    *,
    dir: str,
    job_id: str
):
    CONTAINER_METHOD = os.environ.get("CONTAINER_METHOD")
    if not CONTAINER_METHOD:
        raise Exception("CONTAINER_METHOD environment variable must be set to either docker or apptainer")
    daemon = get_compute_client_daemon(dir=dir, exit_when_idle=False)
    daemon.run_pending_job(job_id=job_id)
