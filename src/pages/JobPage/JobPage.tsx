/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent, useCallback } from "react";
import { useLogin } from "../../LoginContext/LoginContext";
import { useJob } from "../../hooks";
import useRoute from "../../useRoute";
import JobView from "./JobView";

type JobPageProps = {
  width: number;
  height: number;
};

const JobPage: FunctionComponent<JobPageProps> = ({ width, height }) => {
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
  const topBarHeight = 50;
  return (
    <div style={{ position: "absolute", width, height }}>
      <div
        style={{ position: "absolute", top: 0, width, height: topBarHeight }}
      >
        <div style={{ padding: 10 }}>
          <Hyperlink
            onClick={() => {
              setRoute({ page: "service", serviceName: job.serviceName });
            }}
          >
            Back to service
          </Hyperlink>
          <hr />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: topBarHeight,
          width,
          height: height - topBarHeight,
        }}
      >
        <JobView
          width={width}
          height={height - topBarHeight}
          job={job}
          refreshJob={refreshJob}
          deleteJob={handleDeleteJob}
        />
      </div>
    </div>
  );
};

export default JobPage;
