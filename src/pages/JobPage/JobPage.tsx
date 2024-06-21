/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import useRoute from "../../useRoute"
import { useJob, useServiceApp } from "../../hooks"
import { PairioJob } from "../../types"

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
    const { job } = useJob(jobId)
    if (!job) {
        return (
            <div style={{padding: 20}}>
                <h3>Loading...</h3>
            </div>
        )
    }
    return (
        <div style={{padding: 20, maxWidth: 500}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'service', serviceName: job.serviceName})
                }}>
                    Back to service
                </Hyperlink>
            </div>
            <hr />
            <table className="table">
                <tbody>
                    <tr>
                        <td>Job</td>
                        <td>{jobId}</td>
                    </tr>
                    <tr>
                        <td>Service</td>
                        <td>{job.serviceName}</td>
                    </tr>
                    <tr>
                        <td>App</td>
                        <td>{job.jobDefinition.appName}</td>
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
                        <td>Error</td>
                        <td>{job.error}</td>
                    </tr>
                </tbody>
            </table>
            <hr />
            <InputsOutputsView job={job} />
            <hr />
            <ConsoleOutputView consoleOutputUrl={job.consoleOutputUrl} />
        </div>
    )
}

type ConsoleOutputViewProps = {
    consoleOutputUrl: string
}

const ConsoleOutputView: FunctionComponent<ConsoleOutputViewProps> = ({ consoleOutputUrl }) => {
    const { text, refreshText } = useRemoteText(consoleOutputUrl)
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
    const [text, setText] = useState<string | null>(null)
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
    }, [refreshCode])
    return { text, refreshText }
}

type InputsOutputsViewProps = {
    job: PairioJob
}

type InputsOutputsViewRow = {
    type: 'input' | 'output'
    name: string
    fileBaseName: string
    size: number | null | undefined
    url: string | undefined
}

const InputsOutputsView: FunctionComponent<InputsOutputsViewProps> = ({ job }) => {
    const rows = useMemo(() => {
        const r: InputsOutputsViewRow[] = []
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
        return r
    }, [job])
    return (
        <table className="table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>URL</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => {
                    const doLinkToFile = row.url && row.size !== undefined && row.size !== null && row.size < 1000 * 1000 * 10
                    return (
                        <tr key={i}>
                            <td>{row.name}</td>
                            <td>{row.type}</td>
                            <td>{row.size}</td>
                            <td>{
                                doLinkToFile ? (
                                    <a href={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a>
                                ) : (
                                    <span>{row.url || ''}</span>
                                )
                            }</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

export default JobPage