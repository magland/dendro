import { FunctionComponent, useCallback, useEffect, useReducer, useState } from "react"
import { useServiceApp } from "../../hooks"
import { CreateJobRequest, GetJobRequest, PairioAppProcessor, PairioJob, PairioJobDefinition, PairioServiceApp, isCreateJobResponse, isGetJobResponse } from "../../types"
import EditJobDefinitionWindow from "./EditJobDefinitionWindow/EditJobDefinitionWindow"
import { pairioJobDefinitionReducer } from "./EditJobDefinitionWindow/pairioJobDefinitionReducer"
import { JobView } from "../JobPage/JobPage"

type PlaygroundHelloWorldViewProps = {
    serviceName: string
    appName: string
    pairioApiKey?: string
}

const defaultPairioJobDefinition: PairioJobDefinition = {
    appName: '',
    processorName: '',
    inputFiles: [],
    outputFiles: [],
    parameters: []
}

const PlaygroundHelloWorldView: FunctionComponent<PlaygroundHelloWorldViewProps> = ({serviceName, appName, pairioApiKey}) => {
    const { serviceApp } = useServiceApp(serviceName, appName)
    const [processor, setProcessor] = useState<PairioAppProcessor | undefined>()
    const [jobDefinition, jobDefinitionDispatch] = useReducer(pairioJobDefinitionReducer, defaultPairioJobDefinition)
    const [job, setJob] = useState<PairioJob>()
    useEffect(() => {
        if (!serviceApp) return
        if (!processor) return
        jobDefinitionDispatch({type: 'setProcessorName', processorName: processor.name})
        jobDefinitionDispatch({type: 'setAppName', appName: serviceApp.appName})
    }, [serviceApp, processor])
    const handleSubmitJob = useCallback(async () => {
        try {
            const job = await submitJob({
                serviceName,
                jobDefinition,
                pairioApiKey
            })
            setJob(job)
        }
        catch(err: any) {
            alert(`Error in submitJob: ${err.message}`)
        }
    }, [jobDefinition, pairioApiKey, serviceName])
    const refreshJob = useCallback(async () => {
        if (!job) return
        try {
            const req: GetJobRequest = {
                type: 'getJobRequest',
                jobId: job.jobId,
                includePrivateKey: false
            }
            const url = '/api/getJob'
            const headers = {
            }
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(req)
            })
            if (!resp.ok) {
                throw Error(`Error in getJobRequest: ${await resp.text()}`)
                return
            }
            const json = await resp.json()
            if (!isGetJobResponse(json)) {
                console.warn(json)
                throw Error(`Unexpected response for getJobRequest`)
                return
            }
            setJob(json.job)
        }
        catch(err: any) {
            alert(`Error in refreshJob: ${err.message}`)
        }
    }, [job])
    if (!serviceApp) {
        return <div>Loading app...</div>
    }
    return (
        <div>
            <h3>Hello world</h3>
            <ProcessorSelector serviceApp={serviceApp} processor={processor} onChange={setProcessor} />
            {
                processor && (
                    <>
                        <EditJobDefinitionWindow
                            jobDefinition={jobDefinition}
                            jobDefinitionDispatch={jobDefinitionDispatch}
                            processor={processor}
                            readOnly={false}
                            show={'all'}
                            setValid={() => {}}
                        />
                        <div>
                            <button onClick={() => {
                                handleSubmitJob()
                            }}>Submit job</button>
                        </div>
                    </>
                )
            }
            {job && <JobView job={job} refreshJob={refreshJob} />}
        </div>
    )
}

type ProcessorSelectorProps = {
    serviceApp: PairioServiceApp
    processor?: PairioAppProcessor
    onChange: (processor?: PairioAppProcessor) => void
}

const ProcessorSelector: FunctionComponent<ProcessorSelectorProps> = ({serviceApp, processor, onChange}) => {
    return (
        <div>
            <select value={processor ? processor.name : ''} onChange={evt => {
                const processorName = evt.target.value
                const newProcessor = serviceApp.appSpecification.processors.find(processor => (processor.name === processorName))
                if (!newProcessor) {
                    onChange(undefined)
                    return
                }
                onChange(newProcessor)
            }}>
                <option value={''}>Select a processor</option>
                {serviceApp.appSpecification.processors.map(processor => (
                    <option key={processor.name} value={processor.name}>{processor.name}</option>
                ))}
            </select>
        </div>
    )
}

const submitJob = async (o: {jobDefinition: PairioJobDefinition, pairioApiKey?: string, serviceName: string}): Promise<PairioJob> => {
    const { jobDefinition, pairioApiKey, serviceName } = o
    if (!pairioApiKey) {
        throw new Error('pairioApiKey is required')
    }

    const req: CreateJobRequest = {
        type: 'createJobRequest',
        serviceName,
        userId: '',  // determined from the api key
        batchId: '',
        tags: [],
        jobDefinition,
        requiredResources: {
            numCpus: 1,
            numGpus: 0,
            memoryGb: 4,
            timeSec: 60
        },
        secrets: [],
        jobDependencies: [],
        skipCache: false,
        rerunFailing: false,
        deleteFailing: false
    }
    console.info('jobDefinition', jobDefinition)
    const headers = {
        'Authorization': `Bearer: ${pairioApiKey}`
    }
    const url = '/api/createJob'
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(req)
    })
    if (!resp.ok) {
        throw new Error(`Error in submitJob: ${await resp.text()}`)
    }
    const json = await resp.json()
    if (!isCreateJobResponse(json)) {
        throw new Error(`Unexpected response for createJobRequest`)
    }
    const job = json.job
    return job
}

export default PlaygroundHelloWorldView