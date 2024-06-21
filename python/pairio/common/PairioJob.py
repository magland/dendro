from typing import Union, List
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


class PairioJobInputFile(BaseModel):
    name: str
    fileBaseName: str
    url: str


class PairioJobOutputFile(BaseModel):
    name: str
    fileBaseName: str


class PairioJobParameter(BaseModel):
    name: str
    value: Union[str, None] = None


class PairioJobRequiredResources(BaseModel):
    numCpus: int
    numGpus: int
    memoryGb: float
    timeSec: float


class PairioJobSecret(BaseModel):
    name: str
    value: str


class PairioJobDefinition(BaseModel):
    appName: str
    processorName: str
    inputFiles: List[PairioJobInputFile]
    outputFiles: List[PairioJobOutputFile]
    parameters: List[PairioJobParameter]
    cacheBust: Union[str, None] = None  # Note: it is very important to set exclude_none=True when serializing this model

class PairioJobOutputFileResult(BaseModel):
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

class PairioJob(BaseModel):
    jobId: str
    jobPrivateKey: Union[str, None]
    serviceName: str
    userId: str
    batchId: str
    tags: List[str]
    jobDefinition: PairioJobDefinition
    jobDefinitionHash: str
    jobDependencies: List[str]
    requiredResources: PairioJobRequiredResources
    secrets: Union[List[PairioJobSecret], None]
    inputFileUrlList: List[str]
    outputFileUrlList: List[str]
    outputFileResults: List[PairioJobOutputFileResult]
    consoleOutputUrl: str
    resourceUtilizationLogUrl: str
    timestampCreatedSec: float
    timestampStartingSec: Union[float, None]
    timestampStartedSec: Union[float, None]
    timestampFinishedSec: Union[float, None]
    canceled: bool
    status: str
    isRunnable: bool
    error: Union[str, None]
    computeClientId: Union[str, None]
    computeClientName: Union[str, None]
    imageUri: Union[str, None]

    @property
    def job_url(self):
        return f'https://pairio.vercel.app/job/{self.jobId}'

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

# // PairioJobInputFile
# export type PairioJobInputFile = {
#   name: string
#   fileBaseName: string
#   url: string
# }

# // PairioJobOutputFile
# export type PairioJobOutputFile = {
#   name: string
#   fileBaseName: string
#   url: string
# }

# // PairioJobParameter
# export type PairioJobParameter = {
#   name: string
#   value: string | number | boolean | string[] | number[] | boolean[] | null // null means undefined
# }

# // PairioJobRequiredResources
# export type PairioJobRequiredResources = {
#   numCpus: number
#   numGpus: number
#   memoryGb: number
#   timeSec: number
# }

# // PairioJobSecret
# export type PairioJobSecret = {
#   name: string
#   value: string
# }

# // PairioJobStatus
# export type PairioJobStatus = 'pending' | 'starting' | 'running' | 'completed' | 'failed'

# // PairioJobDefinition
# export type PairioJobDefinition = {
#   appName: string
#   processorName: string
#   inputFiles: PairioJobInputFile[]
#   outputFiles: PairioJobOutputFile[]
#   parameters: PairioJobParameter[]
# }
