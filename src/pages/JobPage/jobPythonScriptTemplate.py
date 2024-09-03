import os
from dendro.client import submit_job
from dendro.client import DendroJobDefinition, DendroJobRequiredResources
from dendro.client import DendroJobParameter, DendroJobInputFile, DendroJobOutputFile


service_name = os.getenv('DENDRO_SERVICE_NAME', '{{ job.serviceName }}')

def create_job():
    job_def = DendroJobDefinition(
        appName='{{ job.jobDefinition.appName }}',
        processorName='{{ job.jobDefinition.processorName }}',
        inputFiles=[
            {% for inputFile in job.jobDefinition.inputFiles %}
            DendroJobInputFile(
                name='{{ inputFile.name }}',
                fileBaseName='{{ inputFile.fileBaseName }}',
                url='{{ inputFile.url }}'
            ),
            {% endfor %}
        ],
        outputFiles=[
            {% for outputFile in job.jobDefinition.outputFiles %}
            DendroJobOutputFile(
                name='{{ outputFile.name }}',
                fileBaseName='{{ outputFile.fileBaseName }}'
            ),
            {% endfor %}
        ],
        parameters=[
            {% for parameter in job.jobDefinition.parameters %}
            DendroJobParameter(
                name='{{ parameter.name }}',
                value='{{ parameter.value }}'
            ),
            {% endfor %}
        ]
    )
    required_resources = DendroJobRequiredResources(
        numCpus={{ job.requiredResources.numCpus }},
        numGpus={{ job.requiredResources.numGpus }},
        memoryGb={{ job.requiredResources.memoryGb }},
        timeSec={{ job.requiredResources.timeSec }},
    )
    job = submit_job(
        service_name=service_name,
        job_definition=job_def,
        required_resources=required_resources,
        tags=['example'],
        rerun_failing=True
    )
    return job


if __name__ == '__main__':
    job = create_job()
    print(job.job_url, job.status)
