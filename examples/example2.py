import os
from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources, PairioJobOutputFile, PairioJobParameter


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
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,
        required_resources=required_resources,
        tags=['example']
    )
    print(job.job_url, job.status)

if __name__ == '__main__':
    main()
