import { FunctionComponent, useEffect, useMemo, useState } from "react"
import JobsTable from "./JobsTable"
import { useJobs } from "../../hooks"
import { SmallIconButton } from "@fi-sci/misc"
import { Delete, Refresh } from "@mui/icons-material"
import { PairioJobStatus } from "../../types"

type JobsViewProps = {
    serviceName: string
    computeClientId?: string
}

type JobFilter = {
    status?: PairioJobStatus
    appName?: string
    processorName?: string
}

const pairioJobStatusOptions = [
    'pending', 'starting', 'running', 'completed', 'failed'
]

const JobsView: FunctionComponent<JobsViewProps> = ({computeClientId, serviceName}) => {
    const { jobs, deleteJobs, refreshJobs } = useJobs({computeClientId, serviceName})
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
    const [filter, setFilter] = useState<JobFilter>({})
    useEffect(() => {
        if (!jobs) return;
        // make sure we aren't selecting any jobs that no longer exist
        const existingJobsIds = new Set(jobs.map(j => j.jobId))
        setSelectedJobIds(x => (
            x.filter(id => (existingJobsIds.has(id))
        )))
    }, [jobs])
    const filteredJobs = useMemo(() => {
        if (!jobs) return undefined
        return jobs.filter(job => {
            if (filter.status) {
                if (job.status !== filter.status) return false
            }
            if (filter.appName) {
                if (job.jobDefinition.appName !== filter.appName) return false
            }
            if (filter.processorName) {
                if (job.jobDefinition.processorName !== filter.processorName) return false
            }
            return true
        })
    }, [jobs, filter])
    const appProcessorPairs = useMemo(() => {
        const a: string[] = []
        for (const job of jobs || []) {
            const str = `${job.jobDefinition.appName}::${job.jobDefinition.processorName}`
            if (!a.includes(str)) {
                a.push(str)
            }
        }
        return a.map(str => {
            const parts = str.split('::')
            return {appName: parts[0], processorName: parts[1]}
        })
    }, [jobs])
    if (!filteredJobs) {
        return (
            <div>Loading jobs</div>
        )
    }
    return (
        <div>
            <div>
                <SmallIconButton
                    icon={<Refresh />}
                    onClick={refreshJobs}
                />
                {selectedJobIds.length > 0 && (
                    <SmallIconButton
                        icon={<Delete />}
                        onClick={() => {
                            const ok = window.confirm(`Delete ${selectedJobIds.length} jobs?`)
                            if (!ok) return
                            deleteJobs(selectedJobIds)
                        }}
                    />
                )}
            </div>
            <div>&nbsp;</div>
            <FilterSelector
                filter={filter}
                setFilter={setFilter}
                appProcessorPairs={appProcessorPairs}
            />
            <div>&nbsp;</div>
            <JobsTable
                jobs={filteredJobs}
                selectedJobIds={selectedJobIds}
                onSelectedJobIdsChanged={setSelectedJobIds}
            />
        </div>
    )
}

type FilterSelectorProps = {
    filter: JobFilter
    setFilter: (filter: JobFilter) => void
    appProcessorPairs: {appName: string, processorName: string}[]
}

const FilterSelector: FunctionComponent<FilterSelectorProps> = ({filter, setFilter, appProcessorPairs}) => {
    const allAppNames = useMemo(() => {
        const a: string[] = []
        for (const x of appProcessorPairs) {
            if (!a.includes(x.appName)) {
                a.push(x.appName)
            }
        }
        return a
    }, [appProcessorPairs])
    const allProcessorNames = useMemo(() => {
        if (filter.appName) {
            const a: string[] = []
            for (const x of appProcessorPairs) {
                if (x.appName === filter.appName) {
                    a.push(x.processorName)
                }
            }
            return a
        }
        else {
            const a: string[] = []
            for (const x of appProcessorPairs) {
                if (!a.includes(x.processorName)) {
                    a.push(x.processorName)
                }
            }
            return a
        }
    }, [appProcessorPairs, filter.appName])
    // if the app changed, reset the processor
    useEffect(() => {
        setFilter({...filter, processorName: undefined})
    }, [filter.appName])
    return (
        <div style={{display: 'flex', gap: 10}}>
            <div>
                <select
                    value={filter.status || ''}
                    onChange={e => {
                        const status = e.target.value as PairioJobStatus
                        setFilter({...filter, status})
                    }}
                >
                    <option value={''}>[Status]</option>
                    {pairioJobStatusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>
            <div>
                <select
                    value={filter.appName || ''}
                    onChange={e => {
                        const appName = e.target.value
                        setFilter({...filter, appName})
                    }}
                >
                    <option value={''}>[App]</option>
                    {allAppNames.map(appName => (
                        <option key={appName} value={appName}>{appName}</option>
                    ))}
                </select>
            </div>
            <div>
                <select
                    value={filter.processorName || ''}
                    onChange={e => {
                        const processorName = e.target.value
                        setFilter({...filter, processorName})
                    }}
                >
                    <option value={''}>[Processor]</option>
                    {allProcessorNames.map(processorName => (
                        <option key={processorName} value={processorName}>{processorName}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}

export default JobsView