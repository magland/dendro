from typing import List
from ..common.PairioJob import PairioJob
from ..common.api_requests import set_job_status


class JobManager:
    def __init__(
        self, *,
        compute_client_id: str,
        compute_client_private_key: str
    ) -> None:
        self._compute_client_id = compute_client_id
        self._compute_client_private_key = compute_client_private_key

        # important to keep track of which jobs we attempted to start
        # so that we don't attempt multiple times in the case where starting failed
        self._attempted_to_start_job_ids = set()
        self._attempted_to_fail_job_ids = set()

    def handle_jobs(self, jobs: List[PairioJob]):
        for job in jobs:
            self._start_job(job)

    def _start_job(self, job: PairioJob):
        job_id = job.jobId
        if job_id in self._attempted_to_start_job_ids or job_id in self._attempted_to_fail_job_ids:
            return '' # see above comment about why this is necessary
        self._attempted_to_start_job_ids.add(job_id)
        app_name = job.jobDefinition.appName
        processor_name = job.jobDefinition.processorName
        try:
            print(f'Starting job {job_id} {app_name}:{processor_name}')
            from ._start_job import _start_job
            return _start_job(
                job=job,
                compute_client_id=self._compute_client_id
            )
        except Exception as e: # pylint: disable=broad-except
            # do a traceback
            import traceback
            traceback.print_exc()
            msg = f'Failed to start job: {str(e)}'
            print(msg)
            self._fail_job(job, msg)
            return ''

    def do_work(self):
        pass

    def _fail_job(self, job: PairioJob, error: str):
        job_id = job.jobId
        if job_id in self._attempted_to_fail_job_ids:
            return '' # see above comment about why this is necessary
        self._attempted_to_fail_job_ids.add(job_id)
        job_id = job.jobId
        job_private_key = job.jobPrivateKey
        print(f'Failing job {job_id}: {error}')
        set_job_status(
            job_id=job_id,
            job_private_key=job_private_key,
            compute_client_id=self._compute_client_id,
            status='failed',
            error=error
        )
