from typing import List, Union, Any
from .. import BaseModel

class PairioAppProcessorParameter(BaseModel):
    name: str
    type: str
    description: str
    defaultValue: Any
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

# // PairioAppProcessorParameter
# export type PairioAppProcessorParameter = {
#   name: string
#   type: PairioAppProcessorParameterTypes
#   description: string
#   defaultValue: string | number | boolean | string[] | number[] | undefined
#   options?: any[]
# }
#
# // PairioAppProcessorAttribute
# export type PairioAppProcessorAttribute = {
#   name: string
#   value: string | number | boolean | string[] | number[] | boolean[]
# }
