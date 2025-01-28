from typing import List, Union, Any
from pydantic import BaseModel, Field

from .DendroJob import SpecialJobOutput


class DendroAppProcessorParameter(BaseModel):
    name: str
    type: str
    description: str
    defaultValue: Union[str, int, float, bool, List[str], List[int], List[float], None] = None
    options: Union[List, None] = None


class DendroAppProcessorInputFile(BaseModel):
    name: str
    description: str
    list: Union[bool, None] = None


class DendroAppProcessorOutputFile(BaseModel):
    name: str
    description: str
    urlDeterminedAtRuntime: Union[bool, None] = None


class DendroAppProcessorAttribute(BaseModel):
    name: str
    value: Any


class DendroAppProcessor(BaseModel):
    name: str
    description: str
    label: str
    image: str
    executable: str
    inputs: List[DendroAppProcessorInputFile]
    outputs: List[DendroAppProcessorOutputFile]
    parameters: List[DendroAppProcessorParameter]
    attributes: List[DendroAppProcessorAttribute]


class DendroAppSpecification(BaseModel):
    name: str
    description: str
    processors: List[DendroAppProcessor]


class DendroServiceApp(BaseModel):
    serviceName: str
    appName: str
    appSpecificationUri: str
    appSpecificationCommit: str
    appSpecification: DendroAppSpecification

# // DendroServiceApp
# export type DendroServiceApp = {
#   serviceName: string
#   appName: string
#   appSpecificationUri: string
#   appSpecificationCommit: string
#   appSpecification: DendroAppSpecification
# }

# // DendroAppProcessor
# export type DendroAppProcessor = {
#   name: string
#   description: string
#   label: string
#   image: string
#   executable: string
#   inputs: DendroAppProcessorInputFile[]
#   outputs: DendroAppProcessorOutputFile[]
#   parameters: DendroAppProcessorParameter[]
#   attributes: DendroAppProcessorAttribute[]
# }

# // DendroAppSpecification
# export type DendroAppSpecification = {
#   name: string
#   description: string
#   processors: DendroAppProcessor[]
# }

# // DendroAppProcessorInputFile
# export type DendroAppProcessorInputFile = {
#   name: string
#   description: string
# }

# // DendroAppProcessorOutputFile
# export type DendroAppProcessorOutputFile = {
#   name: string
#   description: string
#   urlDeterminedAtRuntime: boolean
# }

# // DendroAppProcessorParameterTypes
# export type DendroAppProcessorParameterTypes = 'str' | 'int' | 'float' | 'bool' | 'List[str]' | 'List[int]' | 'List[float]' | 'Optional[str]' | 'Optional[int]' | 'Optional[float]' | 'Optional[bool]'

#
# // DendroAppProcessorAttribute
# export type DendroAppProcessorAttribute = {
#   name: string
#   value: string | number | boolean | string[] | number[] | boolean[]
# }


class DendroJobOutputFile(BaseModel):
    name: str
    fileBaseName: str
    urlDeterminedAtRuntime: Union[bool, None] = None


class DendroJobInputFile(BaseModel):
    name: str
    fileBaseName: str
    url: Union[str, SpecialJobOutput, DendroJobOutputFile]


class DendroJobParameter(BaseModel):
    name: str
    value: Union[str, int, bool, List, None]


class DendroJobDefinition(BaseModel):
    appName: str
    processorName: str
    inputFiles: List[DendroJobInputFile]
    outputFiles: List[DendroJobOutputFile]
    parameters: List[DendroJobParameter]
    cacheBust: Union[str, None] = None  # Note: it is very important to set exclude_none=True when serializing this model

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

class DendroJobRequiredResources(BaseModel):
    numCpus: int
    numGpus: int
    memoryGb: float
    timeSec: float

# // DendroJobRequiredResources
# export type DendroJobRequiredResources = {
#   numCpus: number
#   numGpus: number
#   memoryGb: number
#   timeSec: number
# }

class DendroJobSecret(BaseModel):
    name: str
    value: str


# // DendroJobSecret
# export type DendroJobSecret = {
#   name: string
#   value: string
# }
