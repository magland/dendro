# pairio

This is a prototype for the next Dendro (or whatever we decide to call it).

Note that the current Dendro has many features that are not yet implemented in this prototype. Whereas Dendro is centered around its GUI and project structure, Pairio is starting from a compute-centered approach, where the foundation is a network of apps and compute clients that can run jobs within "pairio services". Once this is sufficiently mature, the GUI and project structure can be built on top of it.

## Installation

```bash
pip install --upgrade pairio
```

[Or install from source.](#install-from-source)

## Getting started

### Hello world on public resources

Let's run a simple example job using remote public resources!

First, you'll need a pairio API key.

* Visit [https://pairio.vercel.app/settings](https://pairio.vercel.app/settings) and log in using GitHub.
* Click "Regenerate API key" and copy the key.
* Set the environtment variable `PAIRIO_API_KEY` to the key you copied. For example, in bash:

```bash
export PAIRIO_API_KEY=your-api-key
```

Now run the first example:

```bash
python examples/example1.py
```

The output should look something like this:

```bash
https://pairio.vercel.app/job/9yS0phSTf1lqgLdKdFa5 completed
```

Well, that was fast! What happened?

It turns out that this exact job was already run by someone else, and the result was stored in the public resource. By default, pairio will check to see if the job has already been run and return the result if it has.

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

The `required_resources` is self-explanatory. This determines whether the job can be run on a give compute client. If the resources are too demanding, the job may never run.

Then `submit_job` is the function that actually queues the pairio job in the central database (or returns an existing job). Here's an explanation of the arguments:

* `service_name` is the name of the service that will run the job. A service is a piece of the pairio network that has a collection of available Apps, a collection of compute clients, and a list of privileged users. In this case the service is `hello_world_service`, which is a public service (with limited resources) that anyone can use.
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

### Install from source

```bash
# clone the repo, then
cd pairio
cd python
pip install -e .
```
