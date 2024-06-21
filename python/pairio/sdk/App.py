from typing import List, Union, Type
import os
import json
from .AppProcessor import AppProcessor
from ._load_spec_from_uri import _load_spec_from_uri
from .ProcessorBase import ProcessorBase
from ..common.pairio_types import PairioAppSpecification, PairioAppProcessor


class PairioAppException(Exception):
    pass

class App:
    """An app"""
    def __init__(
        self,
        app_name: str,
        *,
        description: str
    ) -> None:
        """Construct a new Pairio App

        Args:
            app_name (str): The name of the app
        """
        self._app_name = app_name
        self._description = description
        self._processors: List[AppProcessor] = []

        self._spec_dict: Union[dict, None] = None # this is set when the app is loaded from a spec (internal use only)
        self._spec_uri: Union[str, None] = None # this is set when the app is loaded from a spec_uri (internal use only)

    def add_processor(self, processor_class: Type[ProcessorBase]):
        """Add a processor to the app

        Args:
            processor_class (Type[ProcessorBase]): The processor class for the processor
        """
        P = AppProcessor.from_processor_class(processor_class)
        self._processors.append(P)

    def run(self):
        """This function should be called once in main.py"""
        SPEC_OUTPUT_FILE = os.environ.get('SPEC_OUTPUT_FILE', None)
        if SPEC_OUTPUT_FILE is not None:
            if os.environ.get('JOB_ID', None) is not None:
                raise Exception('Cannot set both JOB_ID and SPEC_OUTPUT_FILE')
            with open(SPEC_OUTPUT_FILE, 'w') as f:
                json.dump(self.get_spec(), f, indent=4)
            return
        JOB_ID = os.environ.get('JOB_ID', None)
        if JOB_ID is None:
            raise KeyError('You must set JOB_ID as an environment variable to run a job')
        JOB_PRIVATE_KEY = os.environ.get('JOB_PRIVATE_KEY', None)
        COMPUTE_CLIENT_ID = os.environ.get('COMPUTE_CLIENT_ID', None)
        if COMPUTE_CLIENT_ID is None:
            raise KeyError('COMPUTE_CLIENT_ID is not set')
        JOB_INTERNAL = os.environ.get('JOB_INTERNAL', None)
        PROCESSOR_EXECUTABLE = os.environ.get('PROCESSOR_EXECUTABLE', None)
        JOB_TIMEOUT_SEC = os.environ.get('JOB_TIMEOUT_SEC', None)
        if JOB_TIMEOUT_SEC is not None:
            JOB_TIMEOUT_SEC = int(JOB_TIMEOUT_SEC)
        if JOB_PRIVATE_KEY is None:
            raise KeyError('JOB_PRIVATE_KEY is not set')
        if JOB_INTERNAL == '1':
            # In this mode, we run the job directly
            # This is called internally by the other run mode (need to explain this better)
            from ._run_job_child_process import _run_job_child_process
            return _run_job_child_process(job_id=JOB_ID, job_private_key=JOB_PRIVATE_KEY, processors=self._processors)

        # In this mode we run the job, including the top-level interactions with the pairio API, such as setting the status and the console output, and checking whether the job has been canceled/deleted
        if PROCESSOR_EXECUTABLE is None:
            raise KeyError('PROCESSOR_EXECUTABLE is not set')

        from ._run_job_parent_process import _run_job_parent_process
        return _run_job_parent_process(
            job_id=JOB_ID,
            job_private_key=JOB_PRIVATE_KEY,
            processor_executable=PROCESSOR_EXECUTABLE,
            job_timeout_sec=JOB_TIMEOUT_SEC,
            compute_client_id=COMPUTE_CLIENT_ID
        )

    def get_spec(self):
        """Get the spec for this app. This is called internally."""
        processors = []
        for processor in self._processors:
            processor_spec = processor.get_spec()
            # validate the processor spec
            PairioAppProcessor(**processor_spec)
            processors.append(
                processor_spec
            )
        spec = {
            'name': self._app_name,
            'description': self._description,
            'processors': processors
        }
        # Validate the spec
        try:
            PairioAppSpecification(**spec)
        except Exception as e:
            raise Exception(f'Error validating spec:\n {e}')
        return spec

    @staticmethod
    def from_spec(spec):
        """Define an app from a spec. This is called internally."""
        app = App(
            app_name=spec['name'],
            description=spec['description'],
        )
        app._spec_dict = spec
        for processor_spec in spec['processors']:
            processor = AppProcessor.from_spec(processor_spec)
            app._processors.append(processor)
        return app

    @staticmethod
    def from_spec_uri(
        spec_uri: str
    ):
        """Define an app from a spec URI (e.g., a gh url to the spec.json blob). This is called internally."""
        spec: dict = _load_spec_from_uri(spec_uri)
        a = App.from_spec(spec)
        a._spec_uri = spec_uri
        return a
