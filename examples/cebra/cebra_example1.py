import os
from pairio.client import submit_job, PairioJobDefinition, PairioJobRequiredResources, PairioJobInputFile, PairioJobOutputFile, PairioJobParameter


service_name = os.getenv('PAIRIO_SERVICE_NAME', 'hello_world_service')

# 000129/sub-Indy/sub-Indy_desc-train_behavior+ecephys.nwb
# https://neurosift.app/?p=/nwb&dandisetId=000129&dandisetVersion=draft&url=https://api.dandiarchive.org/api/assets/2ae6bf3c-788b-4ece-8c01-4b4a5680b25b/download/
url1 = 'https://api.dandiarchive.org/api/assets/2ae6bf3c-788b-4ece-8c01-4b4a5680b25b/download/'

def main():
    job_def = PairioJobDefinition(
        appName='hello_cebra',
        processorName='cebra_nwb_embedding_1',
        inputFiles=[
            PairioJobInputFile(
                name='input',
                fileBaseName='input.nwb',
                url=url1
            )
        ],
        outputFiles=[
            PairioJobOutputFile(
                name='output',
                fileBaseName='embedding.h5'
            )
        ],
        parameters=[
            PairioJobParameter(
                name='max_iterations',
                value=2000
            ),
            PairioJobParameter(
                name='batch_size',
                value=1000
            ),
            PairioJobParameter(
                name='bin_size_msec',
                value=50
            ),
            PairioJobParameter(
                name='output_dimensions',
                value=10
            )
        ]
    )
    required_resources = PairioJobRequiredResources(
        numCpus=4,
        numGpus=0,
        memoryGb=8,
        timeSec=60 * 50
    )
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,

        required_resources=required_resources,
        tags=['example', 'cebra'],
        rerun_failing=True
    )
    print(job.job_url, job.status)


if __name__ == '__main__':
    main()
