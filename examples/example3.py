import os
from dendro.client import submit_job, DendroJobDefinition, DendroJobRequiredResources, DendroJobInputFile, DendroJobOutputFile, DendroJobParameter


service_name = os.getenv('DENDRO_SERVICE_NAME', 'hello_world_service')

def main():
    file1 = DendroJobOutputFile(
        name='output',
        fileBaseName='output.txt'
    )
    job_def = DendroJobDefinition(
        appName='hello_world',
        processorName='hello_world_2',
        inputFiles=[],
        outputFiles=[
            file1
        ],
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
    job1 = submit_job(
        service_name=service_name,
        job_definition=job_def,
        required_resources=required_resources,
        tags=['example']
    )
    print(job1.job_url, job1.status)

    job2_def = DendroJobDefinition(
        appName='hello_world',
        processorName='count_characters',
        inputFiles=[
            DendroJobInputFile(
                name='input',
                fileBaseName='input.txt',
                url=file1
            )
        ],
        outputFiles=[
            DendroJobOutputFile(
                name='output',
                fileBaseName='output.json'
            )
        ],
        parameters=[
            DendroJobParameter(
                name='include_whitespace',
                value=True
            )
        ]
    )
    job2 = submit_job(
        service_name=service_name,
        job_definition=job2_def,
        required_resources=required_resources,
        tags=['example'],
        rerun_failing=True
    )
    print(job2.job_url, job2.status, job2.isRunnable)

if __name__ == '__main__':
    main()
