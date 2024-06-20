from typing import Union
import requests
import tempfile
from pydantic import BaseModel


class InputFileDownloadError(Exception):
    pass


class InputFile(BaseModel):
    name: str # the name of the input within the context of the processor
    url: Union[str, None] = None
    local_file_name: Union[str, None] = None
    job_id: Union[str, None] = None
    job_private_key: Union[str, None] = None

    def get_url(self):
        # here's where we would get the signed download url from the server using the job_id and job_private_key
        return self.url

    def download(self, dest_file_path: Union[str, None] = None):
        if self.local_file_name is not None:
            # In the case of a local file, we just copy it
            if dest_file_path is not None and dest_file_path != self.local_file_name:
                print(f'Copying {self.local_file_name} to {dest_file_path}')
                import shutil
                shutil.copyfile(self.local_file_name, dest_file_path)
                return
            else:
                # The file is already in the right place
                return
        url = self.get_url()
        if url is None:
            raise ValueError('Cannot download file because url is not set')
        if dest_file_path is not None:
            # We have a destination file path and we don't have a cache
            print(f'Downloading {url} to {dest_file_path}')
            _download_file(url, dest_file_path)
            self.local_file_name = dest_file_path
            return
        else:
            # We don't have a destination file path and we don't have a cache
            temp_file_path = tempfile.mktemp(prefix='pairio_input_file_')
            print(f'Downloading {url} to {temp_file_path}')
            _download_file(url, temp_file_path)
            self.local_file_name = temp_file_path
            return

    def is_local(self) -> bool:
        return self.local_file_name is not None

    def get_local_file_name(self) -> Union[str, None]:
        return self.local_file_name

    # validator is needed to be an allowed pydantic type
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, value):
        if isinstance(value, cls):
            return value
        else:
            raise ValueError(f'Unexpected type for InputFile: {type(value)}')

def _download_file(url: str, dest_file_path: str):
    # stream the download
    r = requests.get(url, stream=True, timeout=60 * 60 * 24 * 7)
    if r.status_code != 200:
        raise InputFileDownloadError(f'Error downloading file {url}: {r.status_code} {r.reason}')
    with open(dest_file_path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)
