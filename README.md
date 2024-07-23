# pairio

This is a prototype for the next Dendro (or whatever we decide to call it).

Note that the current Dendro has many features that are not yet implemented in this prototype. Whereas Dendro is centered around its GUI and project structure, Pairio is starting from a compute-centered approach, where the foundation is a network of apps and compute clients that can run jobs within "Pairio services". Once this is sufficiently mature, the GUI and project structure can be built on top of it.

## Installation

```bash
pip install --upgrade pairio
```

[Or install from source.](#install-from-source)

## Getting started

### Hello world on public resources

Let's run a simple example job using remote public resources.

First, you'll need a Pairio API key.

* Visit [https://pairio.vercel.app/settings](https://pairio.vercel.app/settings) and log in using GitHub.
* Click "Regenerate API key" and copy the key.
* Set the environtment variable `PAIRIO_API_KEY` to the key you copied. For example, in bash:

```bash
export PAIRIO_API_KEY=your-api-key
```

Now (after cloning this repo) run the first example:

```bash
python examples/example1.py
```

The output should look something like this:

```bash
https://pairio.vercel.app/job/9yS0phSTf1lqgLdKdFa5 completed
```

Well, that was fast! What happened?

It turns out that this exact job was already run by someone else, and the result was stored in the public resource. By default, Pairio will check to see if the job has already been run and return the result if it has.

Click on that link to see the job details, including the console output which should include the string "Hello, world!" This job has no input or output files, so the console output is the only interesting thing to see.

Let's examine the code:

```python
service_name = os.getenv('PAIRIO_SERVICE_NAME', 'hello_world_service')

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
    service_name=service_name,
    job_definition=job_def,
    required_resources=required_resources,
    tags=['example'],
    rerun_failing=True
)
print(job.job_url, job.status)
```

The `job_def` is the job definition which uniquely defines job in terms of the pairio app, the processor within that app, the inputs, outputs, and parameters. The "hello_world" is installed on the service, and the processor "hello_world_1" is defined within that app. [See here for the source code defining its functionality](https://github.com/magland/pairio/blob/main/apps/hello_world/main.py). The hash of this job definition is what is used to determine whether the job has already been run on the service.

The `required_resources` is self-explanatory. This determines whether the job can be run on a given compute client. If the resources are too demanding, the job may never run.

Then `submit_job` is the function that actually queues the Pairio job in the central database (or returns an existing job). Here's an explanation of the arguments:

* `service_name` is the name of the service that will run the job. A service is a piece of the Pairio network that has a collection of available Apps, a collection of compute clients, and a list of privileged users. In this case the service is `hello_world_service`, which is a public service (with limited resources) that anyone can use.
* `job_definition` is the job definition.
* `required_resources` is the required resources.
* `tags` is a list of tags that can be used to filter jobs.
* `rerun_failing` is a boolean that determines whether to rerun the job if a failing job with the same job definition already exists. If this is set to False (the default) the failing job will be returned.

Other arguments to `submit_job` include `skip_cache` and `delete_failing`.

Now, create a new script `example1_test.py` and modify this example with a custom "name" parameter. Perhaps set it to your own name. Assuming nobody has run that particular job definition, you should see something like

```bash
https://pairio.vercel.app/job/your-job-id pending
```

This will stay in the pending state until a compute client picks it up and runs it. You can check the status of the job by visiting the link.

### Running a job that produces an output file

The second example is a bit more interesting because it creates an output file, namely a text file with the contents "Hello, world!". Try it out!

Here's a breakdown of the code:

```python
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
```

This code should be fairly self-explanatory. In addition to the parameter in the job defintion, we have an output file named "output".

After running the script, you should see something like this:

```bash
https://pairio.vercel.app/job/Pjc2mcych7MOPz5nI1Up completed
```

Opening that link once again brings you to job details where you can click on the URL of the generated output file to see the expected content "Hello, world!".

### Running a job that depends on a previous job

The third example (example3.py) is a bit more complex because it involves a job that depends on the output of a previous job. Pairio will automatically handle the job orchestration for you in that it will not run the dependent job until the previous job has completed successfully.

Let's take a look at the code.

```python
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
    tags=['example'],
    rerun_failing=True
)
print(job2.job_url, job2.status, job2.isRunnable)
```

Running this will produce two jobs and the output will look something like this:

```bash
https://pairio.vercel.app/job/Pjc2mcych7MOPz5nI1Up completed
https://pairio.vercel.app/job/Ctv7xyt66vHvrwIKVasu completed True
```

Click on that second link and you should see the output file "output.json" which contains the number of characters in the input file. The input file is the output of the first job, which is a text file with the contents "Hello, world!".

## Neurosift integration

[Neurosift](https://neurosift.app) is a web-based tool designed for visualizing NWB files, particularly those hosted in the [DANDI Archive](https://dandiarchive.org/). While many of Neurosift’s visualizations are processed client-side and require minimal computational resources, certain visualizations necessitate more intensive data processing that must be handled server-side. The integration of Neurosift with Pairio enables the offloading of these computationally demanding tasks to Pairio’s distributed computing environment.

Upon submitting a job to Pairio via the Neurosift interface, users can monitor its progress directly within Neurosift. Once completed, the visualization’s output is automatically downloaded to the user’s browser for rendering. Because Pairio caches the results of these jobs, subsequent identical requests *by any user* will be served from the cache, without the need to recompute the visualization.

For example, Neurosift users can generate and view [CEBRA emeddings](https://cebra.ai/) for any Units table in an NWB file. [See this example](https://neurosift.app/?p=/nwb&dandisetId=000129&dandisetVersion=draft&url=https://api.dandiarchive.org/api/assets/2ae6bf3c-788b-4ece-8c01-4b4a5680b25b/download/). The source code for this example can be found in [apps/hello_cebra](apps/hello_cebra). Because the job was already run, the results are served from the cache, but you can also submit a new job with a different set of parameters.

As another example, you can view estimated firing rates and power spectra for any raw electrophysiology recording. [See this example](https://neurosift.app/?p=/nwb&url=https://api.dandiarchive.org/api/assets/d4bd92fc-4119-4393-b807-f007a86778a1/download/&dandisetId=000957&dandisetVersion=draft&dandiAssetId=d4bd92fc-4119-4393-b807-f007a86778a1&tab=neurodata-item:/acquisition/ElectricalSeriesAP|ElectricalSeries); Click on the "Dendro Summary" tab. The source code for this example can be found in [apps/hello_neurosift](apps/hello_neurosift).

A third application is viewing video files that are not natively supported in the browser. DANDI supports uploading of .avi files, but currently there is no way to preview/stream those files in the browser. Neurosift provides a workaround by using Pairio to precompute .mp4 files associated with portions of those .avi files. [Here is an example](https://dandiarchive.org/dandiset/001084/draft/files?location=sub-DL18%2Fsub-DL18_ses-211110_image%2Bophys&page=1).

In the future we plan to support more complex operations such as spike sorting that can be launched either from Neurosift or from Python scripts.

### Installing from source

```bash
# clone the repo, then
cd pairio
cd python
pip install -e .
```
