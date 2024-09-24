from typing import Union
import os
import math
import requests
from pydantic import BaseModel
from ..common.api_requests import get_upload_url, finalize_multipart_upload, cancel_multipart_upload, set_output_url, api_get_dandi_api_key


class SetOutputFileException(Exception):
    pass

class OutputFile(BaseModel):
    name: str  # the name of the output within the context of the processor
    file_base_name: str = ''  # the base name of the file (e.g., 'file.txt')
    job_id: Union[str, None] = None
    job_private_key: Union[str, None] = None
    was_uploaded: bool = False
    size: Union[int, None] = None
    url_determined_at_runtime: Union[bool, None] = None
    url_was_set: bool = False
    def upload(self, local_file_name: str, delete_local_file: bool = True):
        if self.url_determined_at_runtime:
            raise Exception('Cannot upload file with url_determined_at_runtime set to True')
        if self.job_id is None:
            raise Exception('Unexpected: job_id is None in OutputFile')
        if self.job_private_key is None:
            raise Exception('Unexpected: job_private_key is None in OutputFile')
        upload_url, download_url = get_upload_url(
            upload_type='output',
            job_id=self.job_id,
            job_private_key=self.job_private_key,
            output_name=self.name,
            other_name=None,
            size=os.path.getsize(local_file_name)
        )
        if isinstance(upload_url, str):
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
        elif isinstance(upload_url, dict):
            print(f'[] Uploading output file {self.name} as multi-part')
            parts = upload_url['parts']
            upload_id = upload_url['uploadId']
            part_size = math.ceil(os.path.getsize(local_file_name) / len(parts))
            upload_parts = []
            with open(local_file_name, 'rb') as f:
                for i, part in enumerate(parts):
                    assert part['partNumber'] == i + 1
                    print(f'[] Uploading output file part {i + 1}/{len(parts)}')
                    start = i * part_size
                    end = min((i + 1) * part_size, os.path.getsize(local_file_name))
                    f.seek(start)
                    resp_upload = requests.put(part['signedUrl'], data=f.read(end - start), timeout=60 * 60 * 24 * 7)
                    if resp_upload.status_code != 200:
                        raise SetOutputFileException(f'Error uploading file to bucket ({resp_upload.status_code}) {resp_upload.reason}: {resp_upload.text}')
                    ETag = resp_upload.headers['ETag']
                    upload_parts.append({
                        'PartNumber': part['partNumber'],
                        'ETag': ETag
                    })
            print('[] Completing multi-part upload')
            finalize_multipart_upload(
                upload_id=upload_id,
                parts=upload_parts,
                job_id=self.job_id,
                job_private_key=self.job_private_key,
                url=download_url,
                size=os.path.getsize(local_file_name)
            )

            self.was_uploaded = True
        else:
            try:
                print('[] Cancelling multi-part upload')
                cancel_multipart_upload(
                    upload_id=upload_url['uploadId'],
                    job_id=self.job_id,
                    job_private_key=self.job_private_key,
                    url=download_url
                )
            except Exception as e:
                print(f'Error cancelling multi-part upload: {e}')
            raise Exception(f'Unexpected type for upload_url: {type(upload_url)}')

    def set_url(self, url: str):
        if not self.url_determined_at_runtime:
            raise Exception('Cannot set url for OutputFile with url_determined_at_runtime set to False')
        if self.job_id is None:
            raise Exception('Unexpected: job_id is None in OutputFile')
        if self.job_private_key is None:
            raise Exception('Unexpected: job_private_key is None in OutputFile')
        set_output_url(
            job_id=self.job_id,
            job_private_key=self.job_private_key,
            output_name=self.name,
            url=url
        )
        self.url_was_set = True

    # For now, we can get the DANDI API key, but only in restricted
    # circumstances. In the future the API key will remain secret on the
    # server.
    def get_dandi_api_key(self):
        if self.job_id is None:
            raise Exception('Unexpected: job_id is None in OutputFile')
        if self.job_private_key is None:
            raise Exception('Unexpected: job_private_key is None in OutputFile')
        return api_get_dandi_api_key(
            job_id=self.job_id,
            job_private_key=self.job_private_key,
            output_name=self.name
        )

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
