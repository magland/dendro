import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent, useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { useServiceApp, useServiceApps, useServices } from "../../hooks"
import { PairioJob, PairioJobDefinition, isPairioJobDefinition } from "../../types"
import useRoute from "../../useRoute"
import EditJobDefinitionWindow from "./EditJobDefinitionWindow/EditJobDefinitionWindow"
import submitJob, { getJob } from "./submitJob"
import { JobView } from "../JobPage/JobPage"

type PlaygroundPageProps = {
    // none
}

type PlaygroundState = {
    pairioApiKey?: string
}

type PlaygroundAction = {
    type: 'set_string'
    key: 'pairioApiKey'
    value: string | undefined
}

const playgroundReducer = (state: PlaygroundState | undefined, action: PlaygroundAction): PlaygroundState | undefined => {
    switch (action.type) {
        case 'set_string': {
            const new_state = { ...state }
            new_state[action.key] = action.value
            return new_state
        }
        default: {
            return state
        }
    }
}

const PlaygroundPage: FunctionComponent<PlaygroundPageProps> = () => {
    const { route, setRoute } = useRoute()
    if (route.page !== 'playground') {
        throw new Error('Invalid route')
    }
    const { serviceName, appName, processorName, jobDefinition: jobDefinitionFromRoute } = route
    const [state, dispatch] = useReducer(playgroundReducer, undefined)
    useLocalStorage(state, dispatch)
    const [job, setJob] = useState<PairioJob | undefined>(undefined)

    const handleSubmitJob = useCallback(async () => {
        try {
            const pairioApiKey = state?.pairioApiKey
            if (!pairioApiKey) {
                throw Error('Pairio API key is not set')
            }
            if (!serviceName) {
                throw Error('Unexpected: no serviceName')
            }
            if (jobDefinitionFromRoute.appName !== appName) {
                throw Error('Inconsistent appName')
            }
            if (jobDefinitionFromRoute.processorName !== processorName) {
                throw Error('Inconsistent appName')
            }
            const j = await submitJob({
                jobDefinition: jobDefinitionFromRoute,
                pairioApiKey,
                serviceName,
            })
            setJob(j)
        }
        catch (err: any) {
            alert(`Error: ${err.message}`)
        }
    }, [state?.pairioApiKey, jobDefinitionFromRoute, serviceName, appName, processorName])

    const handleRefreshJob = useCallback(async () => {
        if (!job) return
        try {
            const j = await getJob({jobId: job.jobId})
            setJob(j)
        }
        catch (err: any) {
            alert(`Error: ${err.message}`)
        }
    }, [job])

    useEffect(() => {
        // job does not match job definition, clear the job
        if (!job) return
        if (!jobDefinitionFromRoute) {
            setJob(undefined)
            return
        }
        if (!jobDefinitionsMatch(jobDefinitionFromRoute, job.jobDefinition)) {
            setJob(undefined)
        }
    }, [job, jobDefinitionFromRoute])

    if (!state) return <div>Loading...</div>
    return (
        <div>
            <div style={{padding: 20}}>
                <h1>Pairio Playground</h1>
                <p>
                    PAIRIO API KEY:&nbsp;
                    <PairioApiKeyInput value={state.pairioApiKey} onChange={pairioApiKey => {
                        dispatch({type: 'set_string', key: 'pairioApiKey', value: pairioApiKey})
                    }} />
                    {
                        !state.pairioApiKey && (
                            <span>
                                &nbsp;
                                <Hyperlink onClick={() => {
                                    setRoute({page: 'settings'})
                                }}>Reset API Key</Hyperlink>
                            </span>
                        )
                    }
                </p>
                <table className="table" style={{maxWidth: 250}}>
                    <tbody>
                        <tr>
                            <td>Service</td>
                            <td>
                                <ServiceSelector serviceName={serviceName} onChange={newServiceName => {
                                    setRoute({...route, serviceName: newServiceName})
                                }} />
                            </td>
                        </tr>
                        {serviceName && (<tr>
                            <td>App</td>
                            <td>
                                <AppSelector serviceName={serviceName} appName={appName} onChange={newAppName => {
                                    setRoute({...route, appName: newAppName})
                                }} />
                            </td>
                        </tr>)}
                        {serviceName && appName && (<tr>
                            <td>Processor</td>
                            <td>
                                <ProcessorSelector serviceName={serviceName} appName={appName} processorName={processorName} onChange={newProcessorName => {
                                    setRoute({...route, processorName: newProcessorName})
                                }} />
                            </td>
                        </tr>)}
                    </tbody>
                </table>
                {
                    (serviceName && appName && processorName) && (
                        <JobDefinitionSelector
                            serviceName={serviceName}
                            appName={appName}
                            processorName={processorName}
                            jobDefinitionFromRoute={jobDefinitionFromRoute}
                            onChange={jobDefinition => {
                                setRoute({...route, jobDefinition})
                            }}
                        />
                    )
                }
                {
                    (serviceName && appName && processorName && jobDefinitionFromRoute) && (
                        <div>
                            <button onClick={handleSubmitJob}>
                                SUBMIT JOB
                            </button>
                        </div>
                    )
                }
                <hr />
                {
                    (serviceName && appName && processorName && job) && (
                        <JobView
                            job={job}
                            refreshJob={handleRefreshJob}
                        />
                    )
                }
            </div>
        </div>
    )
}

type ServiceSelectorProps = {
    serviceName?: string
    onChange: (serviceName?: string) => void
}

const ServiceSelector: FunctionComponent<ServiceSelectorProps> = ({serviceName, onChange}) => {
    const { services } = useServices()
    if (!services) return <div>Loading services...</div>
    return (
        <div>
            <select value={serviceName || ''} onChange={evt => onChange(evt.target.value || undefined)}>
                <option value={''}>Select a service</option>
                {services.map(service => (
                    <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>
                ))}
            </select>
        </div>
    )
}

type AppSelectorProps = {
    serviceName: string
    appName?: string
    onChange: (appName?: string) => void
}

const AppSelector: FunctionComponent<AppSelectorProps> = ({serviceName, appName, onChange}) => {
    const { serviceApps } = useServiceApps(serviceName)
    useEffect(() => {
        // if the app is not in the service, then clear it
        if (!serviceName) return
        if (!serviceApps) return
        if (!appName) return
        if (!serviceApps.find(app => (app.appName === appName))) {
            onChange(undefined)
        }
    }, [serviceName, serviceApps, appName, onChange])
    if (!serviceName) return <div>Select a service</div>
    if (!serviceApps) return <div>Loading service apps...</div>
    return (
        <div>
            <select value={appName || ''} onChange={evt => onChange(evt.target.value || undefined)}>
                <option value={''}>Select an app</option>
                {serviceApps.map(app => (
                    <option key={app.appName} value={app.appName}>{app.appName}</option>
                ))}
            </select>
        </div>
    )
}

type ProcessorSelectorProps = {
    serviceName: string
    appName: string
    processorName?: string
    onChange: (processorName?: string) => void
}

const ProcessorSelector: FunctionComponent<ProcessorSelectorProps> = ({serviceName, appName, processorName, onChange}) => {
    const { serviceApp } = useServiceApp(serviceName, appName)
    useEffect(() => {
        // if the processor is not in the app, then clear it
        if (!serviceName) return
        if (!appName) return
        if (!serviceApp) return
        if (!processorName) return
        if (!serviceApp.appSpecification.processors.find(processor => (processor.name === processorName))) {
            onChange(undefined)
        }
    }, [serviceName, appName, serviceApp, processorName, onChange])
    if (!serviceName) return <div>Select a service</div>
    if (!appName) return <div>Select an app</div>
    if (!serviceApp) return <div>Loading service app...</div>
    return (
        <div>
            <select value={processorName || ''} onChange={evt => onChange(evt.target.value || undefined)}>
                <option value={''}>Select a processor</option>
                {serviceApp.appSpecification.processors.map(processor => (
                    <option key={processor.name} value={processor.name}>{processor.name}</option>
                ))}
            </select>
        </div>
    )
}

type JobDefinitionSelectorProps = {
    serviceName: string
    appName: string
    processorName: string
    jobDefinitionFromRoute?: PairioJobDefinition
    onChange: (jobDefinition: PairioJobDefinition) => void
}

const JobDefinitionSelector: FunctionComponent<JobDefinitionSelectorProps> = ({serviceName, appName, processorName, jobDefinitionFromRoute, onChange}) => {
    const jobDefinitionFromRoute2 = isPairioJobDefinition(jobDefinitionFromRoute) ? jobDefinitionFromRoute : undefined
    const { serviceApp } = useServiceApp(serviceName, appName)
    const processor = useMemo(() => (
        serviceApp && serviceApp.appSpecification.processors.find(p => (p.name === processorName)) || undefined
    ), [serviceApp, processorName])
    const jobDefinition = useMemo(() => {
        if (!serviceApp) return undefined
        if (!processor) return undefined
        const jd: PairioJobDefinition = {
            appName,
            processorName,
            inputFiles: [],
            outputFiles: [],
            parameters: [],
            cacheBust: undefined
        }

        for (const ii of processor.inputs) {
            const x = jobDefinitionFromRoute2 && jobDefinitionFromRoute2.inputFiles.find(jd => (jd.name === ii.name))
            if (x) {
                jd.inputFiles.push(x)
            }
            else {
                jd.inputFiles.push({name: ii.name, url: '', fileBaseName: ''})
            }
        }
        for (const ii of processor.outputs) {
            const x = jobDefinitionFromRoute2 && jobDefinitionFromRoute2.outputFiles.find(jd => (jd.name === ii.name))
            if (x) {
                jd.outputFiles.push(x)
            }
            else {
                jd.outputFiles.push({name: ii.name, fileBaseName: ''})
            }
        }
        for (const pp of processor.parameters) {
            const x = jobDefinitionFromRoute2 && jobDefinitionFromRoute2.parameters.find(jd => (jd.name === pp.name))
            if (x) {
                jd.parameters.push(x)
            }
            else {
                jd.parameters.push({name: pp.name, value: pp.defaultValue ?? null})
            }
        }
        return jd
    }, [jobDefinitionFromRoute2, serviceApp, appName, processorName, processor])

    useEffect(() => {
        if (!jobDefinition) return
        if (!jobDefinitionsMatch(jobDefinition, jobDefinitionFromRoute)) {
            onChange(jobDefinition)
        }
    }, [jobDefinition, jobDefinitionFromRoute, onChange])

    if ((!jobDefinition) || (!processor)) return <div />
    return (
        <EditJobDefinitionWindow
            jobDefinition={jobDefinition}
            setJobDefinition={onChange}
            processor={processor}
        />
    )
}

const jobDefinitionsMatch = (jd1: PairioJobDefinition | undefined, jd2: PairioJobDefinition | undefined) => {
    if ((jd1 === undefined) || (jd2 === undefined)) {
        return jd1 === jd2
    }
    const x = normalizeJobDefinition(jd1)
    const y = normalizeJobDefinition(jd2)
    return JSONStringifyDeterministic(x) === JSONStringifyDeterministic(y)
}

const useLocalStorage = (state: PlaygroundState | undefined, dispatch: (action: PlaygroundAction) => void) => {
    useEffect(() => {
        const json = localStorage.getItem('pairio-playground-state')
        if (!json) {
            dispatch({type: 'set_string', key: 'pairioApiKey', value: undefined})
            return
        }
        const obj = JSON.parse(json)
        if (typeof obj.pairioApiKey === 'string') {
            dispatch({type: 'set_string', key: 'pairioApiKey', value: obj.pairioApiKey})
        }
    }, [dispatch])
    useEffect(() => {
        if (!state) return
        localStorage.setItem('pairio-playground-state', JSON.stringify(state))
    }, [state])
}

type PairioApiKeyInputProps = {
    value?: string
    onChange: (value: string) => void
}

const PairioApiKeyInput: FunctionComponent<PairioApiKeyInputProps> = ({value, onChange}) => {
    return (
        <input type="password" value={value || ''} onChange={evt => onChange(evt.target.value)} />
    )
}

const normalizeJobDefinition = (jobDefinition: PairioJobDefinition) => {
    return {
        ...jobDefinition,
        inputFiles: orderByName(jobDefinition.inputFiles),
        outputFiles: orderByName(jobDefinition.outputFiles),
        parameters: orderByName(jobDefinition.parameters)
    }
}

const orderByName = (arr: any[]) => {
    return arr.sort((a, b) => a.name.localeCompare(b.name));
}

// Thanks: https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify
export const JSONStringifyDeterministic = ( obj: any, space: string | number | undefined =undefined ) => {
    const allKeys: string[] = [];
    JSON.stringify( obj, function( key, value ){ allKeys.push( key ); return value; } )
    allKeys.sort();
    return JSON.stringify( obj, allKeys, space );
}

export default PlaygroundPage