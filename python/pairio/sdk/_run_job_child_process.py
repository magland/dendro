from typing import List
import os
import json
from .InputFile import InputFile
from .OutputFile import OutputFile
from .AppProcessor import AppProcessor
from ..common.PairioJob import PairioJob
from ..common.api_requests import get_job


# An empty object that we can set attributes on
# The user is going to think it's a pydantic model, but it's not
# We'll at least give them a dict() and a model_dump() method
class ContextObject:
    def __init__(self) -> None:
        self._pairio_attributes = {}
    def _pairio_set_attribute(self, name, value):
        self._pairio_attributes[name] = value
        setattr(self, name, value)
    def _pairio_set_attribute_where_name_may_have_dots(self, name, value):
        if '.' not in name:
            self._pairio_set_attribute(name, value)
            return
        parts = name.split('.')
        obj = self
        for part in parts[:-1]:
            if not hasattr(obj, part):
                obj._pairio_set_attribute(part, ContextObject())
            obj = getattr(obj, part)
            assert isinstance(obj, ContextObject), f'Unexpected type for {part}'
        obj._pairio_set_attribute(parts[-1], value)
    def dict(self, *, exclude_none=False):
        ret = {}
        for k, v in self._pairio_attributes.items():
            if exclude_none and v is None:
                continue
            if isinstance(v, ContextObject):
                ret[k] = v.dict(exclude_none=exclude_none)
            else:
                ret[k] = v
        return ret
    def model_dump(self, *, exclude_none=False):
        return self.dict(exclude_none=exclude_none)

def _run_job_child_process(*, job_id: str, job_private_key: str, processors: List[AppProcessor]):
    """
    Used internally to actually run the job by calling the processor function.
    If an app image is being used, this will occur within the container.
    """

    # print statements here will end up in the console output for the job
    print(f'[pairio] Running job: {job_id}')

    # Get a job from the remote pairio API
    job: PairioJob = get_job(job_id=job_id)
    assert isinstance(job, PairioJob)

    # Find the registered processor and the associated processor function
    app_name = job.jobDefinition.appName
    processor_name = job.jobDefinition.processorName
    print(f'[pairio] Processor: {app_name}:{processor_name}')

    processor = next((p for p in processors if p._name == processor_name), None)
    if not processor:
        raise Exception(f'Processor not found: {processor_name}')
    if not processor._processor_class:
        raise Exception(f'Processor does not have a processor_class: {processor_name}')
    processor_class = processor._processor_class

    # Assemble the context for the processor function
    print('[pairio] Assembling context')
    context = ContextObject()
    for input in processor._inputs:
        if not input.list:
            # this input is not a list
            print(f'[pairio] Input: {input.name}')
            input_file = next((i for i in job.jobDefinition.inputFiles if i.name == input.name), None)
            if not input_file:
                raise Exception(f'Input not found: {input.name}')
            x = InputFile(
                name=input_file.name,
                url=input_file.url,
                job_id=job_id,
                job_private_key=job_private_key
            )
            context._pairio_set_attribute(input.name, x)
        else:
            # this input is a list
            print(f'[pairio] Input (list): {input.name}')
            the_list: List[InputFile] = []
            ii = 0
            while True:
                # find a job input of the form <input_name>[ii]
                input_file = next((i for i in job.jobDefinition.inputFiles if i.name == f'{input.name}[{ii}]'), None)
                if input_file is None:
                    # if not found, we must be at the end of the list
                    break
                x = InputFile(
                    name=input_file.name,
                    url=input_file.url,
                    job_id=job_id,
                    job_private_key=job_private_key
                )
                the_list.append(x)
                ii += 1
            print(f'[pairio] Input (list): {input.name} (found {len(the_list)} files)')
            context._pairio_set_attribute(input.name, the_list)
    for output in processor._outputs:
        print(f'[pairio] Output: {output.name}')
        output_file = next((o for o in job.jobDefinition.outputFiles if o.name == output.name), None)
        if not output_file:
            raise Exception(f'Output not found: {output.name}')
        x = OutputFile(
            name=output_file.name,
            job_id=job_id,
            job_private_key=job_private_key
        )
        context._pairio_set_attribute(output.name, x)
    for parameter in processor._parameters:
        job_parameter = next((p for p in job.jobDefinition.parameters if p.name == parameter.name), None)
        if job_parameter is None:
            parameter_value = parameter.defaultValue
        else:
            parameter_value = job_parameter.value
        print(f'[pairio] Parameter: {parameter.name} = {parameter_value}')
        context._pairio_set_attribute_where_name_may_have_dots(parameter.name, parameter_value)

    print('[pairio] Preparing to run processor')
    _set_custom_kachery_storage_backend(job_id=job_id, job_private_key=job_private_key)

    # Run the processor function
    print('[pairio] Running processor')
    processor_class.run(context)

    # Check that all outputs were set
    print('[pairio] Checking outputs')
    for output in processor._outputs:
        x = context._pairio_attributes[output.name]
        assert isinstance(x, OutputFile)
        if not x.was_uploaded:
            raise Exception(f'Output was not uploaded: {output.name}')

    # Write the output_file_sizes.json file
    # (perhaps to be used later when saving things locally)
    if os.path.exists('_pairio'):
        output_file_sizes_fname = '_pairio/output_file_sizes.json'
        output_file_sizes = {}
        for output in processor._outputs:
            x = context._pairio_attributes[output.name]
            assert isinstance(x, OutputFile)
            if x.size is not None:
                output_file_sizes[output.name] = x.size
        with open(output_file_sizes_fname, 'w') as f:
            json.dump(output_file_sizes, f)
    else:
        print(f'WARNING: Cannot write output_file_sizes.json: _pairio directory does not exist in current working directory: {os.getcwd()}')

    # Print a message indicating that the job is complete
    print(f'[pairio] Job complete: {job_id}')


def _set_custom_kachery_storage_backend(*, job_id: str, job_private_key: str):
    try:
        import kachery_cloud as kcl
    except ImportError:
        # if we don't have kachery installed, then let's not worry about it
        return

    try:
        custom_storage_backend = CustomKacheryStorageBackend(job_id=job_id, job_private_key=job_private_key)
        kcl.set_custom_storage_backend(custom_storage_backend)
    except Exception as e:
        print('WARNING: Problem setting custom kachery storage backend:', e)
        return

class CustomKacheryStorageBackend:
    def __init__(self, *, job_id: str, job_private_key: str):
        self._job_id = job_id
        self._job_private_key = job_private_key
    def store_file(self, file_path: str, *, label: str):
        raise Exception('Not implemented: storing other files for job')
        # sha1 = _compute_sha1_of_file(file_path)
        # res = ...
        # upload_url = res['uploadUrl']
        # download_url = res['downloadUrl']

        # import requests
        # with open(file_path, 'rb') as f:
        #     resp_upload = requests.put(upload_url, data=f, timeout=60 * 60 * 24 * 7)
        # if resp_upload.status_code != 200:
        #     raise Exception(f'Error uploading file to bucket ({resp_upload.status_code}) {resp_upload.reason}: {resp_upload.text}')
        # return download_url


def _compute_sha1_of_file(file_path: str):
    import hashlib
    sha1 = hashlib.sha1()
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(2**16)
            if not chunk:
                break
            sha1.update(chunk)
    return sha1.hexdigest()
