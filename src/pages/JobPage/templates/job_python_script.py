from typing import List
import os
from dendro.client import submit_job
from dendro.client import DendroJob, DendroJobDefinition, DendroJobRequiredResources
from dendro.client import DendroJobOutputFile

{% for job in jobs -%}
# {{ job.jobDefinition.appName }} : {{ job.jobDefinition.processorName }}
{% endfor %}

def create_jobs():
    jobs: List[DendroJob] = []

{% for special_output in specialOutputs %}    # Output for {{ special_output.job_label }}
    output_{{ loop.index }} = DendroJobOutputFile(
        name='{{ special_output.name }}',
        fileBaseName='{{ special_output.fileBaseName }}'
    )

{% endfor -%}
{% for job in jobs %}
    ##############################################
    # {{ job.jobDefinition.appName }} : {{ job.jobDefinition.processorName }}
    service_name = '{{ job.serviceName }}'
    app_name = '{{ job.jobDefinition.appName }}'
    processor_name = '{{ job.jobDefinition.processorName }}'
    job_def = DendroJobDefinition(
        appName=app_name,
        processorName=processor_name,
        inputFiles=[
{% for inputFile in job.jobDefinition.inputFiles -%}
{% if 'output_index' in inputFile %}            DendroJobInputFile(
                name='{{ inputFile.name }}',
                fileBaseName='{{ inputFile.fileBaseName }}',
                url=output_{{ inputFile.output_index + 1 }}
            ),
{% else %}            DendroJobInputFile(
                name='{{ inputFile.name }}',
                fileBaseName='{{ inputFile.fileBaseName }}',
                url='{{ inputFile.url }}'
            ),
{% endif -%}
{% endfor %}        ],
        outputFiles=[
{% for outputFile in job.jobDefinition.outputFiles -%}
{% if 'output_index' in outputFile %}            output_{{ outputFile.output_index + 1 }},
{% else %}            DendroJobOutputFile(
                name='{{ outputFile.name }}',
                fileBaseName='{{ outputFile.fileBaseName }}'
            ),
{% endif -%}
{% endfor %}        ],
        parameters=[
{% for parameter in job.jobDefinition.parameters %}            DendroJobParameter(
                name='{{ parameter.name }}',
                value={{ parameter.value_render }}
            ),
{% endfor %}        ]
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
        target_compute_client_ids=None,
        tags=['example'],
        skip_cache=False,
        rerun_failing=True,
        delete_failing=True
    )
    jobs.append(job)
{% endfor %}
    return jobs



if __name__ == '__main__':
    jobs = create_jobs()
    for job in jobs:
        print(f'{job.jobDefinition.appName} : {job.jobDefinition.processorName} : {job.job_url} : {job.status}')
