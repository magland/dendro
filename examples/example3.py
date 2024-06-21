import os
from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources, PairioJobInputFile, PairioJobOutputFile, PairioJobParameter


service_name = os.getenv('PAIRIO_SERVICE_NAME', 'hello_world_service')

def main():
    job_def = PairioJobDefinition(
        appName='hello_world',
        processorName='hello_world_2',
        inputFiles=[],
        outputFiles=[
            PairioJobOutputFile(
                name='output',
                fileBaseName='output.txt'
            )
        ],
        parameters=[
            PairioJobParameter(
                name='name',
                value='world'
            )
        ]
    )
    required_resources = PairioJobRequiredResources(
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

    job2_def = PairioJobDefinition(
        appName='hello_world',
        processorName='count_characters',
        inputFiles=[
            PairioJobInputFile(
                name='input',
                fileBaseName='input.txt',
                url=job1.get_output('output')
            )
        ],
        outputFiles=[
            PairioJobOutputFile(
                name='output',
                fileBaseName='output.json'
            )
        ],
        parameters=[
            PairioJobParameter(
                name='include_whitespace',
                value=True
            )
        ]
    )
    job2 = submit_job(
        service_name=service_name,
        job_definition=job2_def,
        required_resources=required_resources,
        tags=['example']
    )
    print(job2.job_url, job2.status, job2.isRunnable)

if __name__ == '__main__':
    main()
