from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources


def main():
    job_def = PairioJobDefinition(
        appName='hello_world',
        processorName='hello_world_1',
        inputFiles=[],
        outputFiles=[],
        parameters=[]
    )
    required_resources = PairioJobRequiredResources(
        numCpus=1,
        numGpus=0,
        memoryGb=4,
        timeSec=60
    )
    job = submit_job(
        service_name='hello_world_service',
        job_definition=job_def,
        required_resources=required_resources,
        tags=['example'],
        rerun_failing=True
    )
    print(job.job_url, job.status)

if __name__ == '__main__':
    main()
