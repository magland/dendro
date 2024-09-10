import os
from dendro.client import submit_job, DendroJobDefinition, DendroJobRequiredResources, DendroJobParameter


service_name = os.getenv('DENDRO_SERVICE_NAME', 'hello_world_service')

def main():
    job_def = DendroJobDefinition(
        appName='hello_world',
        processorName='hello_world_1',
        inputFiles=[],
        outputFiles=[],
        parameters=[
            DendroJobParameter(
                name='name',
                value='world'
            )
        ]
    )
    required_resources = DendroJobRequiredResources(
        numCpus=1,
        numGpus=0,
        memoryGb=4,
        timeSec=60
    )
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,
        required_resources=required_resources,
        tags=['example'],
        rerun_failing=True,
        delete_failing=True
    )
    print(job.job_url, job.status)

if __name__ == '__main__':
    main()
