from typing import Optional
import os
import time
import shutil
import multiprocessing
import traceback
from pathlib import Path
from .JobManager import JobManager
from ..common.api_requests import get_pubsub_subscription, get_runnable_jobs_for_compute_client
from ._start_job import _start_job


class ComputeClientDaemon:
    def __init__(
        self, *,
        dir: str,
        compute_client_id: str,
        compute_client_private_key: str,
        compute_client_name: str,
        exit_when_idle: bool
    ) -> None:
        self._dir = dir
        self._compute_client_id = compute_client_id
        self._compute_client_private_key = compute_client_private_key
        self._compute_client_name = compute_client_name
        self._exit_when_idle = exit_when_idle

        self._is_idle = False  # this is relevant only if exit_when_idle is True

        self._job_manager = JobManager(
            compute_client_id=compute_client_id,
            compute_client_private_key=compute_client_private_key
        )

    def start(self, cleanup_old_jobs=True, timeout: Optional[float] = None):
        # Don't import PubsubClient at the top level because it could cause problems inside container, e.g. missing websocket import
        from .PubsubClient import PubsubClient

        timer_handle_jobs = 0

        print('Getting pubsub info')
        pubsub_subscription = get_pubsub_subscription(
            compute_client_id=self._compute_client_id,
            compute_client_private_key=self._compute_client_private_key
        )
        pubnub_subscribe_key = pubsub_subscription['pubnubSubscribeKey']
        pubsub_client = PubsubClient(
            pubnub_subscribe_key=pubnub_subscribe_key,
            pubnub_channel=pubsub_subscription['pubnubChannel'],
            pubnub_user=pubsub_subscription['pubnubUser'],
            compute_client_id=self._compute_client_id
        )

        # # Create file cache directory if needed
        # file_cache_dir = os.path.join(os.getcwd(), 'file_cache')
        # if not os.path.exists(file_cache_dir):
        #     os.makedirs(file_cache_dir)

        # Start cleaning up old job directories
        # It's important to do this in a separate process
        # because it can take a long time to delete all the files in the tmp directories
        # and we don't want to block the main process from handling jobs
        if cleanup_old_jobs:
            cleanup_old_jobs_process = multiprocessing.Process(target=_cleanup_old_job_working_directories, args=(os.getcwd() + '/jobs',))
            cleanup_old_jobs_process.start()
        else:
            cleanup_old_jobs_process = None

        time_interval_to_check_for_new_jobs = 60 * 10
        if self._exit_when_idle:
            time_interval_to_check_for_new_jobs = 60 * 2

        try:
            print('Starting compute client')
            last_report_that_compute_client_is_running = 0
            overall_timer = time.time()
            while True:
                elapsed_handle_jobs = time.time() - timer_handle_jobs
                # normally we will get pubsub messages for updates, but if we don't, we should check every so often
                is_time_to_handle_jobs = elapsed_handle_jobs > time_interval_to_check_for_new_jobs
                try:
                    messages = pubsub_client.take_messages() if pubsub_client is not None else []
                except Exception as e:
                    traceback.print_exc()
                    print(f'Error getting pubsub messages: {e}')
                    messages = []
                jobs_have_changed = False
                for msg in messages:
                    # service_name = msg.get('serviceName', '')
                    # todo: in future we want to restrict to only messages from the services that this compute client is subscribed to
                    if msg['type'] == 'newPendingJob':
                        jobs_have_changed = True
                    elif msg['type'] == 'jobStatusChanged':
                        jobs_have_changed = True
                    elif msg['type'] == 'pingComputeClients':
                        jobs_have_changed = True
                        # will trigger a check for new jobs which will update the last active timestamp

                if is_time_to_handle_jobs or jobs_have_changed:
                    timer_handle_jobs = time.time()
                    try:
                        self._handle_jobs()
                    except Exception as e:
                        traceback.print_exc()
                        print(f'Unexpected error handling jobs: {e}')

                if self._exit_when_idle and not self._is_idle:
                    print('No more jobs to run. Exiting because --exit-when-idle is set.')
                    return

                try:
                    self._job_manager.do_work()
                except Exception as e:
                    traceback.print_exc()
                    print(f'Error doing work: {e}')

                elapsed_since_report_that_compute_client_is_running = time.time() - last_report_that_compute_client_is_running
                if elapsed_since_report_that_compute_client_is_running > 60 * 5:
                    print(f'Compute client is running: {self._compute_client_name}')
                    print(f'Compute client ID: {self._compute_client_id}')
                    config_url = f'https://dendro.vercel.app/compute_client/{self._compute_client_id}'
                    print(f'Configure it here: {config_url}')
                    last_report_that_compute_client_is_running = time.time()

                overall_elapsed = time.time() - overall_timer
                if timeout is not None and overall_elapsed > timeout:
                    print(f'Compute client timed out after {timeout} seconds')
                    return
                if overall_elapsed < 5:
                    time.sleep(0.2) # for the first few seconds we can sleep for a short time
                else:
                    time.sleep(2)
        finally:
            if cleanup_old_jobs_process is not None:
                cleanup_old_jobs_process.terminate()
            if pubsub_client is not None:
                # right now there's no way to kill the pubsub client's websocket connection
                pass

    def run_pending_job(self, job_id: str):
        runnable_jobs, running_jobs = get_runnable_jobs_for_compute_client(
            compute_client_id=self._compute_client_id,
            compute_client_private_key=self._compute_client_private_key,
            job_id=job_id
        )
        if len(runnable_jobs) == 0:
            raise Exception(f'No runnable job with ID {job_id} that is assignable to this compute client')
        if len(runnable_jobs) > 1:
            raise Exception(f'More than one runnable job with ID {job_id} found')
        _start_job(job=runnable_jobs[0], compute_client_id=self._compute_client_id, daemon_mode=False)

    def _handle_jobs(self):
        print('Checking for new jobs')
        runnable_jobs, running_jobs = get_runnable_jobs_for_compute_client(
            compute_client_id=self._compute_client_id,
            compute_client_private_key=self._compute_client_private_key
        )
        if len(runnable_jobs) > 0:
            self._job_manager.handle_jobs(runnable_jobs)
        if len(running_jobs) == 0 and len(runnable_jobs) == 0:
            self._is_idle = True


def _cleanup_old_job_working_directories(dir: str):
    """Delete working dirs that are more than 24 hours old"""
    jobs_dir = Path(dir)
    while True:
        if jobs_dir.exists():
            for job_dir in jobs_dir.iterdir():
                if job_dir.is_dir():
                    elapsed = time.time() - job_dir.stat().st_mtime
                    if elapsed > 24 * 60 * 60:
                        print(f'Removing old working dir {job_dir}')
                        shutil.rmtree(job_dir)
        time.sleep(60)
