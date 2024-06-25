/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink, SmallIconButton } from "@fi-sci/misc"
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { useJob } from "../../hooks"
import { PairioJob } from "../../types"
import useRoute from "../../useRoute"
import { timeAgoString } from "../../timeStrings"
import ServiceNameComponent from "../../components/ServiceNameComponent"
import ServiceAppNameComponent from "../../components/ServiceAppNameComponent"
import { Refresh } from "@mui/icons-material"

type JobPageProps = {
    // none
}

const JobPage: FunctionComponent<JobPageProps> = () => {
    const { route, setRoute } = useRoute()
    // const [errorMessage, setErrorMessage] = useState<string | null>(null)
    if (route.page !== 'job') {
        throw new Error('Invalid route')
    }
    const jobId = route.jobId
    const { job, refreshJob } = useJob(jobId)
    if (!job) {
        return (
            <div style={{padding: 20}}>
                <h3>Loading...</h3>
            </div>
        )
    }
    return (
        <div style={{padding: 20}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'service', serviceName: job.serviceName})
                }}>
                    Back to service
                </Hyperlink>
            </div>
            <hr />
            <JobView job={job} refreshJob={refreshJob} />
        </div>
    )
}

type JobViewProps = {
    job: PairioJob
    refreshJob: () => void
}

export const JobView: FunctionComponent<JobViewProps> = ({ job, refreshJob }) => {
    return (
        <div>
            <div>
                <SmallIconButton
                    onClick={refreshJob}
                    icon={<Refresh />}
                    label="Refresh job"
                    title="Refresh job"
                />
            </div>
            <table className="table" style={{maxWidth: 500}}>
                <tbody>
                    <tr>
                        <td>Job</td>
                        <td>{job.jobId}</td>
                    </tr>
                    <tr>
                        <td>Job definition hash</td>
                        <td>{job.jobDefinitionHash}</td>
                    </tr>
                    <tr>
                        <td>Service</td>
                        <td><ServiceNameComponent serviceName={job.serviceName} /></td>
                    </tr>
                    <tr>
                        <td>App</td>
                        <td><ServiceAppNameComponent serviceName={job.serviceName} appName={job.jobDefinition.appName} /></td>
                    </tr>
                    <tr>
                        <td>Processor</td>
                        <td>{job.jobDefinition.processorName}</td>
                    </tr>
                    <tr>
                        <td>Status</td>
                        <td>
                            {job.status}
                        </td>
                    </tr>
                    <tr>
                        <td>Created</td>
                        <td>{
                            timeAgoString(job.timestampCreatedSec)
                        }</td>
                    </tr>
                    <tr>
                        <td>Starting</td>
                        <td>{job.timestampStartingSec ? timeAgoString(job.timestampStartingSec) : ''}</td>
                    </tr>
                    <tr>
                        <td>Started</td>
                        <td>{job.timestampStartedSec ? timeAgoString(job.timestampStartedSec) : ''}</td>
                    </tr>
                    <tr>
                        <td>Finished</td>
                        <td>{job.timestampFinishedSec ? timeAgoString(job.timestampFinishedSec) : ''}</td>
                    </tr>
                    <tr>
                        <td>Error</td>
                        <td>{job.error}</td>
                    </tr>
                    <tr>
                        <td>Dependencies</td>
                        <td>{
                            job.jobDependencies.join(', ')
                        }</td>
                    </tr>
                </tbody>
            </table>
            <hr />
            <InputsOutputsParametersView job={job} />
            <hr />
            <ConsoleOutputView job={job} />
        </div>
    )
}

type ConsoleOutputViewProps = {
    job: PairioJob
}

const ConsoleOutputView: FunctionComponent<ConsoleOutputViewProps> = ({ job }) => {
    const { text, refreshText } = useRemoteText(job.consoleOutputUrl)
    useEffect(() => {
        // if job changes, refresh text
        refreshText()
    }, [job, refreshText])
    return (
        <div>
            <h3>Console output</h3>
            <Hyperlink onClick={() => {
                refreshText()
            }}>
                Refresh
            </Hyperlink>
            <pre style={{fontSize: 10}}>
                {text}
            </pre>
        </div>
    )
}

const useRemoteText = (url: string) => {
    const [text, setText] = useState<string | null | undefined>(null)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshText = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        ;(async () => {
            setText(null)
            const response = await fetch(url)
            if (canceled) return
            if (response.status === 404) {
                setText(undefined)
                return
            }
            if (response.status !== 200) {
                setText(`Error: ${response.status}`)
                return
            }
            const txt = await response.text()
            if (canceled) return
            setText(txt)
        })()
        return () => {
            canceled = true
        }
    }, [refreshCode, url])
    return { text, refreshText }
}

type InputsOutputsParametersViewProps = {
    job: PairioJob
}

type InputsOutputsParametersViewRow = {
    type: 'input' | 'output' | 'parameter'
    name: string

    // for inputs and outputs
    fileBaseName?: string
    size?: number | null | undefined
    url?: string | undefined

    // for parameters
    value?: any
}

const InputsOutputsParametersView: FunctionComponent<InputsOutputsParametersViewProps> = ({ job }) => {
    const rows = useMemo(() => {
        const r: InputsOutputsParametersViewRow[] = []
        for (const x of job.jobDefinition.inputFiles) {
            r.push({
                type: 'input',
                name: x.name,
                fileBaseName: x.fileBaseName,
                size: undefined,
                url: x.url
            })
        }
        for (const x of job.jobDefinition.outputFiles) {
            const xr = job.outputFileResults.find(y => y.name === x.name)
            r.push({
                type: 'output',
                name: x.name,
                fileBaseName: x.fileBaseName,
                size: xr ? xr.size : undefined,
                url: xr ? xr.url : undefined
            })
        }
        for (const x of job.jobDefinition.parameters) {
            r.push({
                type: 'parameter',
                name: x.name,
                value: x.value
            })
        }
        return r
    }, [job])
    return (
        <table className="table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Value / URL</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => {
                    const doLinkToFile = row.url && row.size !== undefined && row.size !== null && row.size < 1000 * 1000 * 10
                    return (
                        <tr key={i}>
                            <td>{row.name}</td>
                            <td>{row.type}</td>
                            <td>{
                                row.url ? (
                                    doLinkToFile ? (
                                        <a href={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a>
                                    ) : (
                                        <span>{row.url || ''}</span>
                                    )
                                ) : (
                                    <span>{row.value}</span>
                                )
                            }</td>
                            <td>{row.size ? row.size : ''}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

export default JobPage