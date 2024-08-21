import {
  CreateJobRequest,
  FindJobByDefinitionRequest,
  GetJobRequest,
  DendroJob,
  DendroJobDefinition,
  DendroJobRequiredResources,
  isCreateJobResponse,
  isGetJobResponse,
} from "../../types";

const submitJob = async (o: {
  jobDefinition: DendroJobDefinition;
  dendroApiKey?: string;
  serviceName: string;
  requiredResources: DendroJobRequiredResources;
}): Promise<DendroJob> => {
  const { jobDefinition, dendroApiKey, serviceName, requiredResources } = o;
  if (!dendroApiKey) {
    throw new Error("dendroApiKey is required");
  }

  const req: CreateJobRequest = {
    type: "createJobRequest",
    serviceName,
    userId: "", // determined from the api key
    batchId: "",
    tags: [],
    jobDefinition,
    requiredResources,
    secrets: [],
    jobDependencies: [],
    skipCache: false,
    rerunFailing: true,
    deleteFailing: false,
  };
  console.info("jobDefinition", jobDefinition);
  const headers = {
    Authorization: `Bearer: ${dendroApiKey}`,
  };
  const url = "/api/createJob";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw new Error(`Error in submitJob: ${await resp.text()}`);
  }
  const json = await resp.json();
  if (!isCreateJobResponse(json)) {
    throw new Error(`Unexpected response for createJobRequest`);
  }
  const job = json.job;
  return job;
};

export const findJobByDefinition = async (o: {
  jobDefinition: DendroJobDefinition;
  serviceName: string;
}): Promise<DendroJob | undefined> => {
  const { jobDefinition, serviceName } = o;
  const url = "/api/findJobByDefinition";
  const req: FindJobByDefinitionRequest = {
    type: "findJobByDefinitionRequest",
    serviceName,
    jobDefinition,
  };
  const headers = {};
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw Error(`Error in findJobByDefinitionRequest: ${await resp.text()}`);
  }
  const json = await resp.json();
  if (json.job) {
    return json.job || undefined;
  }
};

export const getJob = async (o: { jobId: string }): Promise<DendroJob> => {
  const { jobId } = o;
  const req: GetJobRequest = {
    type: "getJobRequest",
    jobId,
    includePrivateKey: false,
  };
  const url = "/api/getJob";
  const headers = {};
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw Error(`Error in getJobRequest: ${await resp.text()}`);
  }
  const json = await resp.json();
  if (!isGetJobResponse(json)) {
    console.warn(json);
    throw Error(`Unexpected response for getJobRequest`);
  }
  if (!json.job) {
    throw Error(`No job found for jobId: ${jobId}`);
  }
  return json.job;
};

export default submitJob;
