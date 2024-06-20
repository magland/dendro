from typing import Union, List
from xmlrpc.client import Boolean
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
    url: str


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


class PairioJob(BaseModel):
    jobId: str
    jobPrivateKey: Union[str, None]
    serviceName: str
    userId: str
    batchId: str
    projectName: str
    jobDefinition: PairioJobDefinition
    jobDefinitionHash: str
    requiredResources: PairioJobRequiredResources
    secrets: Union[List[PairioJobSecret], None]
    inputFileUrls: List[str]
    outputFileUrls: List[str]
    consoleOutputUrl: str
    resourceUtilizationLogUrl: str
    timestampCreatedSec: float
    timestampStartingSec: Union[float, None]
    timestampStartedSec: Union[float, None]
    timestampFinishedSec: Union[float, None]
    canceled: Boolean
    status: str
    error: Union[str, None]
    computeClientId: Union[str, None]
    computeClientName: Union[str, None]
    imageUri: Union[str, None]


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

# // PairioJob
# export type PairioJob = {
#   jobId: string
#   jobPrivateKey: string | null
#   serviceName: string
#   userId: string
#   batchId: string
#   projectName: string
#   jobDefinition: PairioJobDefinition
#   jobDefinitionHash: string
#   requiredResources: PairioJobRequiredResources
#   secrets: PairioJobSecret[] | null
#   inputFileUrls: string[]
#   outputFileUrls: string[]
#   consoleOutputUrl: string
#   resourceUtilizationLogUrl: string
#   timestampCreatedSec: number
#   timestampStartingSec: number | null
#   timestampStartedSec: number | null
#   timestampFinishedSec: number | null
#   canceled: boolean
#   status: PairioJobStatus
#   error: string | null
#   computeClientId: string | null
#   computeClientName: string | null
#   imageUri: string | null
# }
