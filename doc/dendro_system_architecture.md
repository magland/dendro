# Dendro system architecture

## Overview

Dendro is a data analysis system that aims to provide a user-friendly interface for analyzing DANDI NWB files in a shared and collaborative environment. Dendro has the following capabilities:
* Runs containerized jobs on remote or local compute resources.
* Jobs can be launched either from within Neurosift, a web-based tool for visualizing NWB files, or using Python scripts.
* Memoization of job results to avoid redundant computation.
* Integrates with Neurosift and DANDI to provide a seamless user experience.
* Works with embargoed Dandisets in a secure manner.

## Glossary of terms

* **Dendro processor**: A specific containerized function or script defined within a Dendro app.
    Examples:
    - [CountCharactersProcessor](https://github.com/magland/dendro/blob/8db382926f747092923aeecdf5d0b125746f3ed6/apps/hello_world/main.py#L48-L79) - Demo processor that counts the number of characters in a text file.
    - [CebraNwbEmbeddings6](https://github.com/magland/dendro/blob/main/apps/hello_cebra/CebraNwbEmbedding6.py) - Computes CEBRA embeddings.
* **Dendro app**: A collection of processors (or containerized processing functions). An app can be installed on a Dendro service (see below). Examples:
    - [hello_world](https://github.com/magland/dendro/tree/main/apps/hello_world) - Demo app that includes three example processors.
    - [hello_neurosift](https://github.com/magland/dendro/tree/main/apps/hello_neurosift) - App containing miscellaneous processors used by Neurosift.
* **Dendro job**: A containerized computation task that is run on a Dendro service. A job consists of a job definition, a service name, a definition of required resources, and run-time information such as the status and console logs. Example:
    - [Hello world job](https://dendro.vercel.app/job/Pjc2mcych7MOPz5nI1Up)
* **Dendro job definition**: Defines a job to be run on a Dendro service. It includes the app name, processor name, inputs files (URLs), output files, and parameters. The hash of the job definition is used to determine whether a job has already been run, allowing for caching of results.
* **Dendro service**: A piece of the Dendro network that includes a collection of installed apps, compute clients, and a list of privileged users. Right now Neurosift exclusively uses a service called "hello_world_service". Authorized users can submit jobs to this service either through Neurosift or by using the Dendro Python API. Users can also create their own services.
* **Dendro compute client**: A daemon that runs Dendro jobs. Each compute client is associated with a Dendro service and picks up jobs from a queue. When jobs are submitted to a service, they can optionally be earmarked to be run on a specific compute client. Compute client can in principle represent: a local machine, a SLURM cluster, AWS batch, etc.

## Job submission from the user's perspective

Jobs can be submitted to a Dendro service in two ways:
* From a web-based interface (e.g., Neurosift).
* Using the Dendro Python API.

To understand the former, it is recommended to [work through this Neurosift Dendro tutorial](https://magland.github.io/neurosift-blog/talks/dendro_INCF_assembly_sep_2024.html).

To understand the latter, it is recommended to [work through the hello world examples](https://github.com/magland/dendro/blob/main/README.md).

## Job submission - the nitty-gritty

When a job is submitted to a Dendro service, the following steps occur:

* The job record (job definition, service name, required resources, etc.) is inserted into the central Dendro database with status "pending". Note that if memoization is enabled, the job will not be re-inserted if it has already been run.
* A PubSub message is sent to the Dendro service's PubSub topic. This message just signals that a new job is available.
* The compute clients receive the signal and query the central Dendro database for new jobs that are eligible to be run, depending on the resources available to the client.
* If a new job is available the compute client receives the job and sets the status to "starting". If more than one compute client tries to pick up the same job, the first one to set the status to "starting" (which is an atomic operation) will be the one to run the job.
* At this point, the compute client has access to the job ID as well as the job private key. The job private key is used to authenticate the compute client to the Dendro service when the job is run in order to make changes to the job status, console logs, output files, etc.
* The compute client pulls the Docker image and, when using apptainer, builds the apptainer container.
* The compute client runs the container with special environment variables JOB_ID and JOB_PRIVATE_KEY.
* IMPORTANT: Once the container is running, the compute client can forget about it because the running container has everything it needs to receive the job parameters, upload output files, etc. This is important because it allows the containerized job to run anywhere, even on a different machine than the one that started it. If the compute client is killed, the container will continue to run.
* The containerized job receives the job definition from the central Dendro database, including the input file URLs and parameters.
* The containerized job runs the processor, including streaming from the input files. Automatically, the job will send updates (status, console, etc) to the central Dendro database.
* When finished, the containerized job uploads the output files to a cloud bucket by obtaining presigned upload URLs from the central Dendro database (using the job private key for authentication).
* Finally, the containerized job sends a message to the central Dendro database to set the job status to "completed". Or if there was an error, the job status is set to "failed". The container then exits.

**Special handling for embargoed Dandisets**

In the case of embargoed Dandisets, a DANDI API key is required to access the data. However, we don't want to expose the API key to the containerized job, which could allow stealing of the API key. Instead, the API key is stored in the central Dendro database. The containerized job can query for the presigned URLs for the input files, and the Dendro service will provide these as appropriate based on the authentication via the job private key.

## Location-independent job execution

A nice feature of a Dendro job is that it can be run on any machine that has access to the central Dendro database and the cloud buckets for input/output files. In order for this to work, the Dendro SDK needs to be installed inside the container where the container is being run so that it can communicate with the central Dendro API. For example, [here is the Dockerfile](https://github.com/magland/dendro/blob/main/apps/hello_kilosort4/Dockerfile) for the Kilosort 4 Dendro app. It includes installation of the Dendro SDK.