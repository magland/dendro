from typing import Union, List
import time
from .. import BaseModel


class ComputeClientComputeSlot(BaseModel):
    numCpus: int
    numGpus: int
    memoryGb: float
    timeSec: float
    minNumCpus: int
    minNumGpus: int
    minMemoryGb: float
    minTimeSec: float
    multiplicity: int


class DendroJobInputFile(BaseModel):
    name: str
    fileBaseName: str
    url: str


class DendroJobOutputFile(BaseModel):
    name: str
    fileBaseName: str


class DendroJobParameter(BaseModel):
    name: str
    value: Union[str, int, float, bool, List[str], List[int], List[float], List[bool], None]


class DendroJobRequiredResources(BaseModel):
    numCpus: int
    numGpus: int
    memoryGb: float
    timeSec: float


class DendroJobSecret(BaseModel):
    name: str
    value: str


class DendroJobDefinition(BaseModel):
    appName: str
    processorName: str
    inputFiles: List[DendroJobInputFile]
    outputFiles: List[DendroJobOutputFile]
    parameters: List[DendroJobParameter]
    cacheBust: Union[str, None] = None  # Note: it is very important to set exclude_none=True when serializing this model

class DendroJobOutputFileResult(BaseModel):
    name: str
    fileBaseName: str
    url: str
    size: Union[int, None]

# for purposes of passing the output of one job to the input of another
class SpecialJobOutput(BaseModel):
    jobId: str
    name: str
    fileBaseName: str
    url: str
    size: Union[int, None]

class DendroJob(BaseModel):
    jobId: str
    jobPrivateKey: Union[str, None] = None
    serviceName: str
    userId: str
    batchId: str
    tags: List[str]
    jobDefinition: DendroJobDefinition
    jobDefinitionHash: str
    jobDependencies: List[str]
    requiredResources: DendroJobRequiredResources
    targetComputeClientIds: Union[List[str], None] = None
    secrets: Union[List[DendroJobSecret], None] = None
    inputFileUrlList: List[str]
    outputFileUrlList: List[str]
    outputFileResults: List[DendroJobOutputFileResult]
    consoleOutputUrl: str
    resourceUtilizationLogUrl: str
    timestampCreatedSec: float
    timestampStartingSec: Union[float, None] = None
    timestampStartedSec: Union[float, None] = None
    timestampFinishedSec: Union[float, None] = None
    canceled: bool
    status: str
    isRunnable: bool
    error: Union[str, None] = None
    computeClientId: Union[str, None] = None
    computeClientName: Union[str, None] = None
    computeClientUserId: Union[str, None] = None
    imageUri: Union[str, None] = None

    @property
    def job_url(self):
        return f'https://dendro.vercel.app/job/{self.jobId}'

    def get_output(self, name: str):
        for output in self.outputFileResults:
            if output.name == name:
                return SpecialJobOutput(
                    jobId=self.jobId,
                    name=output.name,
                    fileBaseName=output.fileBaseName,
                    url=output.url,
                    size=output.size
                )
        raise Exception(f'Output not found: {name}')

    def wait_until_done(self, *, wait_sec: Union[float, None] = None):
        from ..common.api_requests import _post_api_request
        done_states = ['completed', 'failed']
        if self.status in done_states:
            print(f'{self.job_url} {self.status}')
            return
        timer = time.time()
        last_status = None
        while True:
            req = {
                'type': 'getJobRequest',
                'jobId': self.jobId,
                'includePrivateKey': False
            }
            resp = _post_api_request(
                url_path='/api/getJob',
                data=req
            )
            if resp['type'] != 'getJobResponse':
                raise Exception(f'Unexpected response: {resp}')
            job = resp.get('job')
            if not job:
                raise Exception(f'Job not found: {self.jobId}')
            job = DendroJob(**job)
            fields_to_copy = [
                'outputFileResults',
                'timestampCreatedSec',
                'timestampStartingSec',
                'timestampStartedSec',
                'timestampFinishedSec',
                'canceled',
                'status',
                'isRunnable',
                'error',
                'computeClientId',
                'computeClientName',
                'imageUri'
            ]
            for field in fields_to_copy:
                setattr(self, field, getattr(job, field))

            if self.status in done_states:
                print(f'{self.job_url} {self.status}')
                break

            if self.status != last_status:
                print(f'{self.job_url} {self.status}')
                if self.status == 'failed':
                    print(f'Error: {self.error}')
                last_status = self.status

            # sleep for a while, depending on how long we've already been waiting
            elapsed = time.time() - timer
            if wait_sec is not None and elapsed > wait_sec:
                print(f'Status: {self.status}')
                break
            if elapsed < 10:
                time.sleep(2)
            elif elapsed < 30:
                time.sleep(4)
            elif elapsed < 60:
                time.sleep(5)
            elif elapsed < 60 * 5:
                time.sleep(20)
            elif elapsed < 60 * 30:
                time.sleep(60)
            else:
                time.sleep(60 * 5)


# // ComputeClientComputeSlot
# export type ComputeClientComputeSlot = {
#   numCpus: number
#   numGpus: number
#   memoryGb: number
#   timeSec: number
#   minNumCpus: number
#   minNumGpus: number
#   minMemoryGb: number
#   minTimeSec: number
#   multiplicity: number
# }

# // DendroJobInputFile
# export type DendroJobInputFile = {
#   name: string
#   fileBaseName: string
#   url: string
# }

# // DendroJobOutputFile
# export type DendroJobOutputFile = {
#   name: string
#   fileBaseName: string
#   url: string
# }

# // DendroJobParameter
# export type DendroJobParameter = {
#   name: string
#   value: string | number | boolean | string[] | number[] | boolean[] | null // null means undefined
# }

# // DendroJobRequiredResources
# export type DendroJobRequiredResources = {
#   numCpus: number
#   numGpus: number
#   memoryGb: number
#   timeSec: number
# }

# // DendroJobSecret
# export type DendroJobSecret = {
#   name: string
#   value: string
# }

# // DendroJobStatus
# export type DendroJobStatus = 'pending' | 'starting' | 'running' | 'completed' | 'failed'

# // DendroJobDefinition
# export type DendroJobDefinition = {
#   appName: string
#   processorName: string
#   inputFiles: DendroJobInputFile[]
#   outputFiles: DendroJobOutputFile[]
#   parameters: DendroJobParameter[]
# }
