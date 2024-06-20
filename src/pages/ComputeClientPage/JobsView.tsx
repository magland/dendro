import { FunctionComponent, useEffect, useState } from "react"
import JobsTable from "./JobsTable"
import { useJobs } from "../../hooks"
import { SmallIconButton } from "@fi-sci/misc"
import { Delete, Refresh } from "@mui/icons-material"

type JobsViewProps = {
    serviceName: string
    computeClientId?: string
}

const JobsView: FunctionComponent<JobsViewProps> = ({computeClientId, serviceName}) => {
    const { jobs, deleteJobs, refreshJobs } = useJobs({computeClientId, serviceName})
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
    useEffect(() => {
        if (!jobs) return;
        // make sure we aren't selecting any jobs that no longer exist
        const existingJobsIds = new Set(jobs.map(j => j.jobId))
        setSelectedJobIds(x => (
            x.filter(id => (existingJobsIds.has(id))
        )))
    }, [jobs])
    if (!jobs) {
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
            <JobsTable
                jobs={jobs}
                selectedJobIds={selectedJobIds}
                onSelectedJobIdsChanged={setSelectedJobIds}
            />
        </div>
    )
}

export default JobsView