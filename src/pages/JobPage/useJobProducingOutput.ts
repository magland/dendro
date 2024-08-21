import { useEffect, useState } from "react";
import { DendroJob, FindJobsRequest, isFindJobsResponse } from "../../types";
import { apiPostRequest } from "../../hooks";

export const useJobProducingOutput = (nwbFileUrl: string) => {
  const [job, setJob] = useState<DendroJob | null | undefined>(undefined);
  useEffect(() => {
    let canceled = false;
    setJob(undefined);
    (async () => {
      const req: FindJobsRequest = {
        type: "findJobsRequest",
        outputFileUrl: nwbFileUrl,
        limit: 1,
      };
      const resp = await apiPostRequest("findJobs", req);
      if (canceled) return;
      if (!isFindJobsResponse(resp)) {
        console.error("Invalid response", resp);
        return;
      }
      const jobs = resp.jobs;
      if (jobs.length === 0) {
        setJob(null);
        return;
      }
      setJob(jobs[0]);
    })();
    return () => {
      canceled = true;
    };
  }, [nwbFileUrl]);
  return job;
};
