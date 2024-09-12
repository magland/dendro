from dendro.client import submit_job, DendroJobDefinition, DendroJobRequiredResources, DendroJobInputFile, DendroJobOutputFile, DendroJobParameter

# https://neurosift.app/?p=/nwb&url=https://api.dandiarchive.org/api/assets/0eab806c-c5c3-4d01-bd7c-15e328a7e923/download/&dandisetId=000363&dandisetVersion=draft
input_url = 'https://api.dandiarchive.org/api/assets/0eab806c-c5c3-4d01-bd7c-15e328a7e923/download/'

service_name = 'hello_world_service'
app_name = 'hello_neurosift'
processor_name = 'tuning_analysis_000363'
job_definition = DendroJobDefinition(
    appName=app_name,
    processorName=processor_name,
    inputFiles=[
        DendroJobInputFile(
            name='input',
            url=input_url,
            fileBaseName='input.nwb'
        )
    ],
    outputFiles=[
        DendroJobOutputFile(
            name='output',
            fileBaseName='output.nwb.lindi.tar'
        )
    ],
    parameters=[
        DendroJobParameter(
            name='units_path',
            value='/units'
        ),
        DendroJobParameter(
            name='behavior_paths',
            value=[
                '/acquisition/BehavioralTimeSeries/Camera0_side_JawTracking',
                '/acquisition/BehavioralTimeSeries/Camera0_side_NoseTracking',
                '/acquisition/BehavioralTimeSeries/Camera0_side_TongueTracking'
            ]
        ),
        DendroJobParameter(
            name='behavior_dimensions',
            value=[
                1,
                1,
                1
            ]
        ),
        DendroJobParameter(
            name='behavior_output_prefixes',
            value=[
                'jaw',
                'nose',
                'tongue'
            ]
        )
    ]
)
required_resources = DendroJobRequiredResources(
    numCpus=4,
    numGpus=0,
    memoryGb=4,
    timeSec=60 * 50
)

job = submit_job(
    service_name=service_name,
    job_definition=job_definition,
    required_resources=required_resources,
    target_compute_client_ids=None,
    tags=[],
    skip_cache=False,
    rerun_failing=True,
    delete_failing=True
)

print(job.job_url, job.status)
