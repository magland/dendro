import os
import subprocess
import time
from typing import Union
from ..common.PairioJob import PairioJob
from ..common.api_requests import set_job_status, get_service_app
from ..common.pairio_types import PairioServiceApp


class JobException(Exception):
    pass


def _start_job(*,
    job: PairioJob,
    compute_client_id: str
):
    job_id = job.jobId
    job_private_key = job.jobPrivateKey
    if job_private_key is None:
        raise JobException('Unexpected: job_private_key is None')
    job_required_resources = job.requiredResources
    set_job_status(
        job_id=job_id,
        job_private_key=job_private_key,
        compute_client_id=compute_client_id,
        status='starting',
        error=None
    )
    app: PairioServiceApp = get_service_app(service_name=job.serviceName, app_name=job.jobDefinition.appName)

    processor = next((p for p in app.appSpecification.processors if p.name == job.jobDefinition.processorName), None)
    if not processor:
        raise JobException(f'Unexpected: processor not found in {job.jobDefinition.appName}: {job.jobDefinition.processorName}')

    processor_image = processor.image
    processor_executable = processor.executable

    # WARNING!!! The job_dir is going to get cleaned up after the job is finished
    # so it's very important to not set the working directory to a directory that is
    # used for other purposes
    job_dir = os.getcwd() + '/jobs/' + job_id
    os.makedirs(job_dir, exist_ok=True)

    env_vars = {
        'PYTHONUNBUFFERED': '1',
        'JOB_ID': job_id,
        'JOB_PRIVATE_KEY': job_private_key,
        'COMPUTE_CLIENT_ID': compute_client_id,
        'PROCESSOR_EXECUTABLE': processor_executable,
        'PAIRIO_API_URL': os.environ.get('PAIRIO_API_URL', 'https://pairio.vercel.app')
    }

    if job_required_resources.timeSec is not None:
        env_vars['JOB_TIMEOUT_SEC'] = str(int(job_required_resources.timeSec))

    # Not doing this any more -- instead we are setting a custom backend for kachery uploads
    # kachery_cloud_client_id, kachery_cloud_private_key = _get_kachery_cloud_credentials()
    # if kachery_cloud_client_id is not None:
    #     env_vars['KACHERY_CLOUD_CLIENT_ID'] = kachery_cloud_client_id
    #     assert kachery_cloud_private_key, 'Unexpected: kachery_cloud_private_key is not set even though kachery_cloud_client_id is set'
    #     env_vars['KACHERY_CLOUD_PRIVATE_KEY'] = kachery_cloud_private_key

    return _run_container_job(
        processor_executable=processor_executable,
        processor_image=processor_image,
        env_vars=env_vars,
        job_dir=job_dir,
        num_cpus=job_required_resources.numCpus,
        use_gpu=job_required_resources.numGpus > 0
        # don't actually limit the memory, because we don't want the process being harshly terminated - it needs to be able to clean up
    )

# This was the method used previously when we wanted to capture the output of the process and display it to the console
# However, that was problematic, because when this parent closes, we don't want a broken pipe
# prefix = f'{job_id} {processor_name}: '
# t1 = threading.Thread(target=stream_output, args=(process.stdout, prefix))
# t1.start()
# prefix = f'{job_id} {processor_name} ERR: '
# t2 = threading.Thread(target=stream_output, args=(process.stderr, prefix))
# t2.start()

# previously did this (see above)
# def stream_output(pipe, prefix: str):
#     while True:
#         try:
#             line = pipe.readline()
#         except:
#             break
#         if line:
#             print(prefix + line.decode('utf-8'))
#         else:
#             break

def _run_container_job(*,
    processor_executable: str,
    processor_image: str,
    env_vars: dict,
    job_dir: str,
    num_cpus: Union[int, None],
    use_gpu: bool
):
    tmpdir = job_dir + '/tmp' # important to provide a /tmp directory for singularity or apptainer so that it doesn't run out of disk space
    os.makedirs(tmpdir, exist_ok=True)
    exe = f'python {processor_executable}' if processor_executable.endswith('.py') else processor_executable
    pairio_api_url = os.getenv('PAIRIO_API_URL', 'https://pairio.vercel.app')

    # We need to create this shell script so that we can catch errors in the parent process
    # and report them back to the server. See comments in the code below.
    run_sh = f'''#!/bin/bash
{exe} > /tmp/_pairio_parent_process_output.txt 2>&1
# check the exit code
exit_code=$?
if [ $exit_code -eq 0 ]; then
    echo "Parent process completed successfully" >> /tmp/_pairio_parent_process_output.txt
    echo "Parent process completed successfully" >> /tmp/_pairio_parent_process_succeeded.txt
else
    echo "Parent process failed with exit code $exit_code" >> /tmp/_pairio_parent_process_output.txt
    echo "Parent process failed" >> /tmp/_pairio_parent_process_failed.txt
fi
'''
    with open(f'{tmpdir}/run.sh', 'w') as f:
        f.write(run_sh)
    container_method = os.environ.get('CONTAINER_METHOD', 'docker')
    if container_method == 'docker':
        tmpdir = job_dir + '/tmp'
        os.makedirs(tmpdir, exist_ok=True)
        os.makedirs(tmpdir + '/working', exist_ok=True)
        cmd2 = [
            'docker', 'run', '-it'
        ]
        cmd2.extend(['-v', f'{tmpdir}:/tmp'])
        env_vars['PAIRIO_JOB_CLEANUP_DIR'] = '/tmp'
        env_vars['PAIRIO_JOB_WORKING_DIR'] = '/tmp/working'
        cmd2.extend(['--workdir', '/tmp/working']) # the working directory will be /tmp/working
        for k, v in env_vars.items():
            cmd2.extend(['-e', f'{k}={v}'])
        # we want kachery temporary files to be stored in the /tmp/.kachery-cloud directory
        cmd2.extend(['-e', 'KACHERY_CLOUD_DIR=/tmp/.kachery-cloud'])
        if num_cpus is not None:
            cmd2.extend(['--cpus', str(num_cpus)])
        if use_gpu:
            cmd2.extend(['--gpus', 'all'])
        if pairio_api_url.startswith('http://localhost:'):
            # in this case we are in dev mode and we need to allow access to the host network
            cmd2.extend(['--network', 'host'])
        cmd2.extend([processor_image])
        cmd2.extend(['/bin/bash', '/tmp/run.sh'])
        print(f'Pulling image {processor_image}')
        subprocess.run(['docker', 'pull', processor_image])
        print(f'Running: {" ".join(cmd2)}')
        subprocess.Popen(
            cmd2,
            cwd=job_dir,
            start_new_session=True, # This is important so it keeps running even if the compute resource is stopped
            # Important to set output to devnull so that we don't get a broken pipe error if this parent process is closed
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    elif container_method == 'singularity' or container_method == 'apptainer':
        os.makedirs(tmpdir, exist_ok=True)
        os.makedirs(tmpdir + '/working', exist_ok=True)

        # determine the appropriate executable
        if container_method == 'singularity':
            executable = 'singularity'
        elif container_method == 'apptainer':
            executable = 'apptainer'
        else:
            raise JobException(f'Unexpected container method (*): {container_method}')

        cmd2 = [executable, 'exec']
        cmd2.extend(['--bind', f'{tmpdir}:/tmp'])
        # The working directory should be /tmp/working so that if the container wants to write to the working directory, it will not run out of space
        env_vars['PAIRIO_JOB_CLEANUP_DIR'] = '/tmp'
        env_vars['PAIRIO_JOB_WORKING_DIR'] = '/tmp/working'
        cmd2.extend(['--pwd', '/tmp/working'])
        cmd2.extend(['--cleanenv']) # this is important to prevent singularity or apptainer from passing environment variables to the container
        cmd2.extend(['--contain']) # we don't want singularity or apptainer to mount the home or tmp directories of the host
        if use_gpu:
            cmd2.extend(['--nv'])
        for k, v in env_vars.items():
            cmd2.extend(['--env', f'{k}={v}'])
        # we want kachery temporary files to be stored in the /tmp/.kachery-cloud directory
        cmd2.extend(['--env', 'KACHERY_CLOUD_DIR=/tmp/.kachery-cloud'])

        if pairio_api_url.startswith('http://localhost:'):
            # in this case we are in dev mode and we need to allow access to the host network
            # maybe nothing special needs to be done here
            pass

        # don't use --cpus for now because we run into cgroups issues and the container fails to start
        # if num_cpus is not None:
        #     cmd2.extend(['--cpus', str(num_cpus)])

        cmd2.extend([f'docker://{processor_image}']) # todo: what if it's not a dockerhub image?
        cmd2.extend(['/bin/bash', '/tmp/run.sh'])
        print(f'Running: {" ".join(cmd2)}')
        subprocess.Popen(
            cmd2,
            cwd=job_dir,
            start_new_session=True, # This is important so it keeps running even if the compute resource is stopped
            # Important to set output to devnull so that we don't get a broken pipe error if this parent process is closed
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        raise JobException(f'Unexpected container method: {container_method}')
    # Wait a bit and see if the process has failed right away. This can often happen
    # an import failes in the main.py, and otherwise we wouldn't catch it
    timer = time.time()
    while (time.time() - timer) < 2:
        if os.path.exists(f'{tmpdir}/_pairio_parent_process_failed.txt'):
            with open(f'{tmpdir}/_pairio_parent_process_output.txt', 'r') as f:
                output = f.read()
            raise JobException(f'Parent process error: {output}')
        elif os.path.exists(f'{tmpdir}/_pairio_parent_process_succeeded.txt'):
            break
        time.sleep(0.1)
