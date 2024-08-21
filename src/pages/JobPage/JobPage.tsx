/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent, useCallback } from "react";
import { useLogin } from "../../LoginContext/LoginContext";
import { useJob } from "../../hooks";
import useRoute from "../../useRoute";
import JobView from "./JobView";

type JobPageProps = {
  // none
};

const JobPage: FunctionComponent<JobPageProps> = () => {
  const { route, setRoute } = useRoute();
  // const [errorMessage, setErrorMessage] = useState<string | null>(null)
  if (route.page !== "job") {
    throw new Error("Invalid route");
  }
  const jobId = route.jobId;
  const { job, refreshJob, deleteJob } = useJob(jobId);
  const { userId } = useLogin();
  const handleDeleteJob = useCallback(() => {
    if (!job) return;
    if (!userId) {
      alert("Not logged in");
      return;
    }
    const okay = window.confirm("Are you sure you want to delete this job?");
    if (!okay) return;
    deleteJob().then(() => {
      setRoute({ page: "service", serviceName: job.serviceName });
    });
  }, [job, setRoute, deleteJob, userId]);
  if (!job) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Loading...</h3>
      </div>
    );
  }
  return (
    <div style={{ padding: 20 }}>
      <div>
        <Hyperlink
          onClick={() => {
            setRoute({ page: "service", serviceName: job.serviceName });
          }}
        >
          Back to service
        </Hyperlink>
      </div>
      <hr />
      <JobView job={job} refreshJob={refreshJob} deleteJob={handleDeleteJob} />
    </div>
  );
};

export default JobPage;
