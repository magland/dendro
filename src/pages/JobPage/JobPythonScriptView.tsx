import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { DendroJob, GetJobRequest, isGetJobResponse } from "../../types";
import Markdown from "../../components/Markdown/Markdown";
import jobPythonScriptTemplate from "./templates/job_python_script.py?raw";
import nunjucks from "nunjucks";
import { apiPostRequest } from "../../hooks";

// test: http://localhost:3000/job/6WoKHDb8D3BvrMq0giLF

nunjucks.configure({ autoescape: false });

type JobPythonScriptViewProps = {
  job: DendroJob;
};

const JobPythonScriptView: FunctionComponent<JobPythonScriptViewProps> = ({
  job,
}) => {
  const [message, setMessage] = useState<string>("");
  const jobs = useJobPipelineForJob(job);
  const script = useMemo(() => {
    if (!jobs) {
      return "# Loading job pipeline...";
    }

    const specialOutputs: { jobId: string, name: string, fileBaseName: string, job_label: string, url: string }[] = [];
    for (const job of jobs) {
      for (const output of job.outputFileResults) {
        const url = output.url;
        let isInputToAnotherJob = false;
        for (const otherJob of jobs) {
          if (otherJob.jobDefinition.inputFiles.some((file) => file.url === url)) {
            isInputToAnotherJob = true;
            break;
          }
        }
        if (isInputToAnotherJob) {
          specialOutputs.push({
            jobId: job.jobId,
            name: output.name,
            fileBaseName: output.fileBaseName,
            job_label: job.jobDefinition.processorName,
            url,
          });
        }
      }
    }
    const jobs2 = jobs.map((job) => ({
      ...job,
      jobDefinition: {
        ...job.jobDefinition,
        inputFiles: job.jobDefinition.inputFiles.map((file) => {
          const ind = specialOutputs.map(o => o.url).indexOf(file.url);
          if (ind >= 0) {
            return {
              ...file,
              output_index: ind,
            };
          }
          else {
            return file;
          }
        }),
        outputFiles: job.jobDefinition.outputFiles.map((file) => {
          const ind = specialOutputs.map(o => `${o.jobId}|${o.name}`).indexOf(`${job.jobId}|${file.name}`);
          if (ind >= 0) {
            return {
              ...file,
              output_index: ind,
            };
          }
          else {
            return file;
          }
        }),
        parameters: job.jobDefinition.parameters.map((param) => ({
          ...param,
          value_render: JSON.stringify(param.value),
        })),
      },
    }));
    return nunjucks.renderString(jobPythonScriptTemplate, { jobs: jobs2, specialOutputs });
  }, [jobs]);
  const md = useMemo(() => {
    if (jobs === null) {
      return `Error loading job pipeline for job ${job.jobId}`;
    }
    return `
\`\`\`python
${script}
\`\`\`
`;
  }, [script, job.jobId, jobs]);
  return (
    <div>
      <div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(script);
            setMessage("Script copied to clipboard");
          }}
        >
          Copy script
        </button>
      </div>
      {message && <p>{message}</p>}
      <Markdown source={md} />
    </div>
  );
};

const useJobPipelineForJob = (job: DendroJob) => {
  const [jobs, setJobs] = useState<DendroJob[] | undefined | null>(undefined);
  useEffect(() => {
    let canceled = false;
    const allJobs: DendroJob[] = [];
    const jobIdsVisited = new Set<string>(); // To avoid infinite loops
    const processJob = async (job: DendroJob) => {
      if (canceled) return;
      if (jobIdsVisited.has(job.jobId)) {
        return;
      }
      jobIdsVisited.add(job.jobId);
      for (const jobId of job.jobDependencies) {
        const dependencyJob = await getDendroJob(jobId);
        await processJob(dependencyJob);
      }
      allJobs.push(job);
    };
    processJob(job).then(() => {
      if (canceled) return;
      setJobs(allJobs);
    }).catch((err) => {
      console.error(err);
      setJobs(null);
    });
    return () => {
      canceled = true;
    };
  }, [job]);
  return jobs;
};

const getDendroJob = async (jobId: string): Promise<DendroJob> => {
  const req: GetJobRequest = {
    type: "getJobRequest",
    jobId,
    includePrivateKey: false,
  };
  const resp = await apiPostRequest("getJob", req);
  if (!isGetJobResponse(resp)) {
    console.error("Invalid response", resp);
    throw new Error("Invalid response");
  }
  if (!resp.job) {
    throw new Error("Job not found");
  }
  return resp.job;
}

export default JobPythonScriptView;
