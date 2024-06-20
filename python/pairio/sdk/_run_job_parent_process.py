import os
import time
import json
from typing import Union, Dict, Any
import subprocess
from ..internal_job_monitoring.console_output_monitor import do_upload as _upload_final_console_output
import shutil
from ..common.api_requests import set_job_status


# This function is called internally by the compute resource daemon through the pairio CLI
# * Sets the job status to running in the database via the API
# * Runs the job in a separate process by calling the app executable with the appropriate env vars
# * Launches detached processes to monitor the console output, resource utilization, and job status
# * Finally, sets the job status to completed or failed in the database via the API

if os.environ.get('PAIRIO_JOB_WORKING_DIR', None) is None:
    pairio_internal_folder = '_pairio'
else:
    pairio_internal_folder = os.environ['PAIRIO_JOB_WORKING_DIR'] + '/_pairio'

def _run_job_parent_process(*, job_id: str, job_private_key: str, processor_executable: str, job_timeout_sec: Union[int, None], compute_client_id: str):
    _run_job_timer = time.time()

    if os.path.exists(pairio_internal_folder):
        shutil.rmtree(pairio_internal_folder)
    os.mkdir(pairio_internal_folder)
    console_out_fname = os.path.join(pairio_internal_folder, 'console_output.txt')
    cancel_out_fname = os.path.join(pairio_internal_folder, 'cancel.txt')
    console_out_monitor_output_fname = os.path.join(pairio_internal_folder, 'console_output_monitor_output.txt')
    resource_utilization_monitor_output_fname = os.path.join(pairio_internal_folder, 'resource_utilization_monitor_output.txt')
    job_status_monitor_output_fname = os.path.join(pairio_internal_folder, 'job_status_monitor_output.txt')

    # set the job status to running by calling the remote pairio API
    _debug_log(f'Running job {job_id}')
    set_job_status(
        job_id=job_id,
        job_private_key=job_private_key,
        status='running',
        compute_client_id=compute_client_id,
        error=None
    )

    last_report_timestamp = 0

    proc = None

    with open(console_out_fname, 'w') as console_out_file, open(console_out_monitor_output_fname, 'w') as console_out_monitor_output_file, open(resource_utilization_monitor_output_fname, 'w') as resource_utilization_monitor_output_file, open(job_status_monitor_output_fname, 'w') as job_status_monitor_output_file:
        succeeded = False # whether we succeeded in running the job without an exception
        error_message = '' # if we fail, this will be set to the exception message
        try:
            # start the console output monitor
            cmd = f'pairio internal-job-monitor console_output --parent-pid {os.getpid()}'
            env = {
                'JOB_ID': job_id,
                'JOB_PRIVATE_KEY': job_private_key,
                'CONSOLE_OUT_FILE': os.path.abspath(console_out_fname)
            }
            _launch_detached_process(cmd=cmd, env=env, stdout=console_out_monitor_output_file, stderr=subprocess.STDOUT)

            # start the resource utilization monitor
            cmd = f'pairio internal-job-monitor resource_utilization --parent-pid {os.getpid()}'
            env = {
                'JOB_ID': job_id,
                'JOB_PRIVATE_KEY': job_private_key
            }
            _launch_detached_process(cmd=cmd, env=env, stdout=resource_utilization_monitor_output_file, stderr=subprocess.STDOUT)

            # start the status check monitor
            cmd = f'pairio internal-job-monitor job_status --parent-pid {os.getpid()}'
            env = {
                'JOB_ID': job_id,
                'JOB_PRIVATE_KEY': job_private_key,
                'CANCEL_OUT_FILE': cancel_out_fname
            }
            _launch_detached_process(cmd=cmd, env=env, stdout=job_status_monitor_output_file, stderr=subprocess.STDOUT)

            # Launch the job in a separate process
            proc = _launch_job_child_process(
                job_id=job_id,
                job_private_key=job_private_key,
                processor_executable=processor_executable,
                console_out_file=console_out_file
            )

            while True:
                try:
                    retcode = proc.wait(1)
                    # don't check this now -- wait until after we had a chance to read the last console output
                except subprocess.TimeoutExpired:
                    retcode = None # process is still running

                if retcode is not None:
                    if retcode != 0:
                        raise ValueError(f'Error running job: return code {retcode}')
                    # job has completed with exit code 0
                    break

                # check if the cancel file has been created
                if os.path.exists(cancel_out_fname):
                    with open(cancel_out_fname, 'r') as f:
                        cancel_msg = f.read()
                    _debug_log(f'Job canceled: {cancel_msg}')
                    raise Exception(f'Job canceled: {cancel_msg}')

                # check job timeout
                if job_timeout_sec is not None:
                    elapsed = time.time() - _run_job_timer
                    if elapsed > job_timeout_sec:
                        raise Exception(f'Job timed out: {elapsed} > {job_timeout_sec} seconds')

                elapsed_since_report = time.time() - last_report_timestamp
                if elapsed_since_report >= 120:
                    last_report_timestamp = time.time()
                    _debug_log('Job still running')

                time.sleep(3)
            succeeded = True # No exception
        except Exception as e: # pylint: disable=broad-except
            _debug_log(f'Error running job: {str(e)}')
            succeeded = False
            error_message = str(e)
        finally:
            if proc is not None:
                _debug_log('Closing subprocess')
                try:
                    if proc.stdout:
                        proc.stdout.close()
                    if proc.stderr:
                        proc.stderr.close()
                    proc.terminate()
                except Exception: # pylint: disable=broad-except
                    pass

            pairio_job_cleanup_dir = os.environ.get('PAIRIO_JOB_CLEANUP_DIR', None)
            if pairio_job_cleanup_dir is not None:
                _debug_log(f'Cleaning up PAIRIO_JOB_CLEANUP_DIR: {pairio_job_cleanup_dir}')
                try:
                    # delete files in the cleanup dir but do not delete the cleanup dir itself
                    # and also don't delete the internal log folder _pairio
                    def _delete_files_in_dir(dir: str):
                        for fname in os.listdir(dir):
                            fpath = os.path.join(dir, fname)
                            if os.path.isdir(fpath):
                                if fname == '_pairio':
                                    # don't delete the internal log folder
                                    continue
                                _delete_files_in_dir(fpath)
                            else:
                                if fname.startswith('_pairio'):
                                    # don't delete pairio system files
                                    continue
                                _debug_log(f'Deleting {fpath}')
                                os.remove(fpath)
                    _delete_files_in_dir(pairio_job_cleanup_dir)
                except Exception as e:
                    _debug_log(f'WARNING: problem cleaning up PAIRIO_JOB_CLEANUP_DIR: {str(e)}')
            else:
                _debug_log('No PAIRIO_JOB_CLEANUP_DIR environment variable set. Not cleaning up.')

    _debug_log('Uploading final console output')
    # this is needed because the console output monitor may get terminated before it has a chance to upload the final console output
    ok, errmsg = _upload_final_console_output(
        job_id=job_id,
        job_private_key=job_private_key,
        console_out_file=console_out_fname
    )
    if not ok:
        _debug_log('WARNING: problem uploading final console output')
        _debug_log(errmsg)

    # get the output file sizes
    # this is important for the case of skipCloudUpload=True
    _debug_log('Reading output file sizes')
    output_file_sizes_fname = f'{pairio_internal_folder}/output_file_sizes.json'
    output_file_sizes = None
    if os.path.exists(output_file_sizes_fname):
        with open(output_file_sizes_fname, 'r') as f:
            output_file_sizes = json.load(f)

    # Set the final job status
    _debug_log('Finalizing job')
    _finalize_job(
        job_id=job_id,
        job_private_key=job_private_key,
        succeeded=succeeded,
        error_message=error_message,
        output_file_sizes=output_file_sizes,
        compute_client_id=compute_client_id
    )

    _debug_log('Exiting')

def _launch_job_child_process(*, job_id: str, job_private_key: str, processor_executable: str, console_out_file: Any):
    # Set the appropriate environment variables and launch the job in a background process
    cmd = ['python', processor_executable] if processor_executable.endswith('.py') else [processor_executable]
    env = os.environ.copy()
    env = {
        **env,
        'JOB_ID': job_id,
        'JOB_PRIVATE_KEY': job_private_key,
        'COMPUTE_CLIENT_ID': 'pairio_compute_client_id',
        'JOB_INTERNAL': '1',
        'PYTHONUNBUFFERED': '1'
    }
    _debug_log(f'Running {processor_executable} (Job ID: {job_id})) (Job private key: {job_private_key})')
    working_dir = os.environ.get('PAIRIO_JOB_WORKING_DIR', None)
    if working_dir is not None:
        if not os.path.exists(working_dir):
            # make directory including parent directories
            os.makedirs(working_dir)
        if not os.path.isdir(working_dir + '/tmp'):
            os.mkdir(working_dir + '/tmp')
        env['PAIRIO_JOB_WORKING_DIR'] = working_dir
        env['TMPDIR'] = working_dir + '/tmp'
        _debug_log(f'Using working directory {working_dir}')
    _debug_log('Opening subprocess')
    proc = subprocess.Popen(
        cmd,
        env=env,
        stdout=console_out_file,
        stderr=subprocess.STDOUT,
        cwd=working_dir
    )
    return proc

def _finalize_job(*, job_id: str, job_private_key: str, succeeded: bool, error_message: str, output_file_sizes: Union[dict, None] = None, compute_client_id: str):
    try:
        if succeeded:
            # The job has completed successfully - update the status accordingly
            _debug_log('Setting job status to completed')
            print('Job completed')
            set_job_status(
                job_id=job_id,
                job_private_key=job_private_key,
                status='completed',
                # output_file_sizes=output_file_sizes,  # maybe do this in the future
                compute_client_id=compute_client_id,
                error=None
            )
        else:
            # The job has failed - update the status accordingly and set the error message
            _debug_log('Setting job status to failed: ' + error_message)
            print('Job failed: ' + error_message)
            set_job_status(
                job_id=job_id,
                job_private_key=job_private_key,
                status='failed',
                compute_client_id=compute_client_id,
                error=error_message
            )
    except Exception as e: # pylint: disable=broad-except
        # This is unfortunate - we completed the job, but somehow failed to update the status in the pairio system - maybe there was a network error (maybe we should retry?)
        _debug_log('WARNING: problem setting final job status: ' + str(e))
        print('WARNING: problem setting final job status: ' + str(e))

class SetJobStatusError(Exception):
    pass


def _launch_detached_process(*, cmd: str, env: Dict[str, str], stdout: Any, stderr: Any):
    _debug_log(f'Launching detached process: {cmd}')
    subprocess.Popen(
        cmd.split(' '),
        env={
            **os.environ.copy(),
            **env
        },
        stdout=stdout,
        stderr=stderr,
        start_new_session=True
    )

def _debug_log(msg: str):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    msg2 = f'{timestamp} {msg}'
    print(msg2)
    # write to pairio-job.log
    # this will be written to the working directory, which should be in the job dir
    with open(f'{pairio_internal_folder}/pairio-job.log', 'a', encoding='utf-8') as f:
        f.write(msg2 + '\n')
