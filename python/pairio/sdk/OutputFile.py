from typing import Union
import os
import requests
from pydantic import BaseModel
from ..common.api_requests import get_upload_url


class SetOutputFileException(Exception):
    pass

class OutputFile(BaseModel):
    name: str  # the name of the output within the context of the processor
    job_id: Union[str, None] = None
    job_private_key: Union[str, None] = None
    was_uploaded: bool = False
    size: Union[int, None] = None
    def upload(self, local_file_name: str, delete_local_file: bool = True):
        if self.job_id is None:
            raise Exception('Unexpected: job_id is None in OutputFile')
        if self.job_private_key is None:
            raise Exception('Unexpected: job_private_key is None in OutputFile')
        upload_url = get_upload_url(
            upload_type='output',
            job_id=self.job_id,
            job_private_key=self.job_private_key,
            output_name=self.name,
            other_name=None,
            size=os.path.getsize(local_file_name)
        )

        print(f'[] Uploading output file {self.name}') # it could be a security issue to provide the url in this print statement
        with open(local_file_name, 'rb') as f:
            resp_upload = requests.put(upload_url, data=f, timeout=60 * 60 * 24 * 7)
            if resp_upload.status_code != 200:
                print(upload_url)
                raise SetOutputFileException(f'Error uploading file to bucket ({resp_upload.status_code}) {resp_upload.reason}: {resp_upload.text}')

        if delete_local_file:
            print(f'[] Deleting local file {local_file_name}')
            if os.path.exists(local_file_name):
                os.remove(local_file_name)

        self.was_uploaded = True

    # validator is needed to be an allowed pydantic type
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, value):
        if isinstance(value, cls):
            return value
        else:
            raise ValueError(f'Unexpected type for OutputFile: {type(value)}')
