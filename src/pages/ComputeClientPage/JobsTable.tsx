import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent } from "react";
import { PairioJob } from "../../types";
import useRoute from "../../useRoute";

type JobsTableProps = {
    jobs: PairioJob[]
    selectedJobIds?: string[]
    onSelectedJobIdsChanged?: (selectedJobIds: string[]) => void
}

const JobsTable: FunctionComponent<JobsTableProps> = ({ jobs, selectedJobIds, onSelectedJobIdsChanged }) => {
    const { setRoute } = useRoute()
    return (
        <table className="table">
            <thead>
                <tr>
                    {selectedJobIds && (<th />)}
                    <th>Job</th>
                    <th>Service</th>
                    <th>App/Processor</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>Compute client</th>
                </tr>
            </thead>
            <tbody>
                {jobs.map((job) => (
                    <tr key={job.jobId}>
                        {selectedJobIds && (
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedJobIds.includes(job.jobId)}
                                    onChange={e => {
                                        if (onSelectedJobIdsChanged) {
                                            if (e.target.checked) {
                                                onSelectedJobIdsChanged([...selectedJobIds, job.jobId])
                                            }
                                            else {
                                                onSelectedJobIdsChanged(selectedJobIds.filter(id => (id !== job.jobId)))
                                            }
                                        }
                                    }}
                                />
                            </td>
                        )}
                        <td>
                            <Hyperlink
                                onClick={() => {
                                    setRoute({page: 'job', jobId: job.jobId})
                                }}
                            >
                                {job.jobId}
                            </Hyperlink>
                        </td>
                        <td>{job.serviceName}</td>
                        <td>{job.jobDefinition.appName}/{job.jobDefinition.processorName}</td>
                        <td>{job.status}</td>
                        <td>{job.userId}</td>
                        <td>{job.computeClientName}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default JobsTable