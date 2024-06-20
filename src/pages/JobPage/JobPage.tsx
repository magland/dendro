/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import useRoute from "../../useRoute"
import { useJob, useServiceApp } from "../../hooks"

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

export default JobPage