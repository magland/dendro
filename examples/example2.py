from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources, PairioJobOutputFile


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
        parameters=[]
    )
    required_resources = PairioJobRequiredResources(
        numCpus=1,
        numGpus=0,
        memoryGb=4,
        timeSec=60
    )
    job_id = submit_job(
        service_name='hello_world_service',
        job_definition=job_def,
        required_resources=required_resources
    )
    print(job_id)

if __name__ == '__main__':
    main()
