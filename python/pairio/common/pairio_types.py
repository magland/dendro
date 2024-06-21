from typing import List, Union, Any

from .PairioJob import SpecialJobOutput
from .. import BaseModel

class PairioAppProcessorParameter(BaseModel):
    name: str
    type: str
    description: str
    defaultValue: Union[str, int, float, bool, List[str], List[int], List[float], None] = None
    options: Union[List, None] = None


class PairioAppProcessorInputFile(BaseModel):
    name: str
    description: str
    list: Union[bool, None] = None


class PairioAppProcessorOutputFile(BaseModel):
    name: str
    description: str


class PairioAppProcessorAttribute(BaseModel):
    name: str
    value: Any


class PairioAppProcessor(BaseModel):
    name: str
    description: str
    label: str
    image: str
    executable: str
    inputs: List[PairioAppProcessorInputFile]
    outputs: List[PairioAppProcessorOutputFile]
    parameters: List[PairioAppProcessorParameter]
    attributes: List[PairioAppProcessorAttribute]


class PairioAppSpecification(BaseModel):
    name: str
    description: str
    processors: List[PairioAppProcessor]


class PairioServiceApp(BaseModel):
    serviceName: str
    appName: str
    appSpecificationUri: str
    appSpecificationCommit: str
    appSpecification: PairioAppSpecification

# // PairioServiceApp
# export type PairioServiceApp = {
#   serviceName: string
#   appName: string
#   appSpecificationUri: string
#   appSpecificationCommit: string
#   appSpecification: PairioAppSpecification
# }

# // PairioAppProcessor
# export type PairioAppProcessor = {
#   name: string
#   description: string
#   label: string
#   image: string
#   executable: string
#   inputs: PairioAppProcessorInputFile[]
#   outputs: PairioAppProcessorOutputFile[]
#   parameters: PairioAppProcessorParameter[]
#   attributes: PairioAppProcessorAttribute[]
# }

# // PairioAppSpecification
# export type PairioAppSpecification = {
#   name: string
#   description: string
#   processors: PairioAppProcessor[]
# }

# // PairioAppProcessorInputFile
# export type PairioAppProcessorInputFile = {
#   name: string
#   description: string
# }

# // PairioAppProcessorOutputFile
# export type PairioAppProcessorOutputFile = {
#   name: string
#   description: string
# }

# // PairioAppProcessorParameterTypes
# export type PairioAppProcessorParameterTypes = 'str' | 'int' | 'float' | 'bool' | 'List[str]' | 'List[int]' | 'List[float]' | 'Optional[str]' | 'Optional[int]' | 'Optional[float]' | 'Optional[bool]'

#
# // PairioAppProcessorAttribute
# export type PairioAppProcessorAttribute = {
#   name: string
#   value: string | number | boolean | string[] | number[] | boolean[]
# }

class PairioJobInputFile(BaseModel):
    name: str
    fileBaseName: str
    url: Union[str, SpecialJobOutput]


class PairioJobOutputFile(BaseModel):
    name: str
    fileBaseName: str


class PairioJobParameter(BaseModel):
    name: str
    value: Union[str, int, bool, List, None]


class PairioJobDefinition(BaseModel):
    appName: str
    processorName: str
    inputFiles: List[PairioJobInputFile]
    outputFiles: List[PairioJobOutputFile]
    parameters: List[PairioJobParameter]
    cacheBust: Union[str, None] = None  # Note: it is very important to set exclude_none=True when serializing this model

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

class PairioJobRequiredResources(BaseModel):
    numCpus: int
    numGpus: int
    memoryGb: float
    timeSec: float

# // PairioJobRequiredResources
# export type PairioJobRequiredResources = {
#   numCpus: number
#   numGpus: number
#   memoryGb: number
#   timeSec: number
# }

class PairioJobSecret(BaseModel):
    name: str
    value: str


# // PairioJobSecret
# export type PairioJobSecret = {
#   name: string
#   value: string
# }
