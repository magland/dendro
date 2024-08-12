import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../useRoute"

type JobComponentProps = {
    jobId: string
}

const JobComponent: FunctionComponent<JobComponentProps> = ({ jobId }) => {
    const { setRoute } = useRoute()
    const jobIdDisplay = jobId
    return (
        <Hyperlink
            onClick={() => {
                setRoute({page: 'job', jobId: jobId})
            }}
            color='#383'
        >{jobIdDisplay}</Hyperlink>
    )
}

export default JobComponent