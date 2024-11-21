/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import allowCors from "./allowCors"; // remove .js for local dev
import { SubscribeRequest, SubscribeTokenObject } from "./ephemeriPubsubTypes"; // remove .js for local dev
import { getMongoClient } from "./getMongoClient"; // remove .js for local dev
import publishPubsubMessage from "./publishPubsubMessage"; // remove .js for local dev
import {
  AddServiceAppResponse,
  AddServiceResponse,
  AddUserResponse,
  CancelJobResponse,
  CancelMultipartUploadResponse,
  ComputeClientComputeSlot,
  ComputeUserStatsResponse,
  CreateComputeClientResponse,
  CreateJobResponse,
  DeleteComputeClientResponse,
  DeleteJobsResponse,
  DeleteServiceAppResponse,
  DeleteServiceResponse,
  DendroComputeClient,
  DendroJob,
  DendroJobDefinition,
  DendroJobOutputFileResult,
  DendroService,
  DendroServiceApp,
  DendroUser,
  FinalizeMultipartUploadResponse,
  FindJobByDefinitionResponse,
  FindJobsResponse,
  GetComputeClientResponse,
  GetComputeClientsResponse,
  GetDandiApiKeyResponse,
  GetJobResponse,
  GetPubsubSubscriptionResponse,
  GetRunnableJobResponse,
  GetRunnableJobsForComputeClientResponse,
  GetServiceAppResponse,
  GetServiceAppsResponse,
  GetServiceResponse,
  GetServicesResponse,
  GetSignedDownloadUrlResponse,
  GetSignedUploadUrlResponse,
  PingComputeClientsResponse,
  ResetUserApiKeyResponse,
  SetComputeClientInfoResponse,
  SetJobStatusResponse,
  SetServiceAppInfoResponse,
  SetServiceInfoResponse,
  SetUserInfoResponse,
  UserStats,
  isAddServiceAppRequest,
  isAddServiceRequest,
  isAddUserRequest,
  isCancelJobRequest,
  isCancelMultipartUploadRequest,
  isComputeUserStatsRequest,
  isCreateComputeClientRequest,
  isCreateJobRequest,
  isDeleteComputeClientRequest,
  isDeleteJobsRequest,
  isDeleteServiceAppRequest,
  isDeleteServiceRequest,
  isDendroComputeClient,
  isDendroJob,
  isDendroService,
  isDendroServiceApp,
  isDendroUser,
  isFinalizeMultipartUploadRequest,
  isFindJobByDefinitionRequest,
  isFindJobsRequest,
  isGetComputeClientRequest,
  isGetComputeClientsRequest,
  isGetDandiApiKeyRequest,
  isGetJobRequest,
  isGetPubsubSubscriptionRequest,
  isGetRunnableJobRequest,
  isGetRunnableJobsForComputeClientRequest,
  isGetServiceAppRequest,
  isGetServiceAppsRequest,
  isGetServiceRequest,
  isGetServicesRequest,
  isGetSignedDownloadUrlRequest,
  isGetSignedUploadUrlRequest,
  isPingComputeClientsRequest,
  isResetUserApiKeyRequest,
  isSetComputeClientInfoRequest,
  isSetJobStatusRequest,
  isSetServiceAppInfoRequest,
  isSetServiceInfoRequest,
  isSetUserInfoRequest,
  issetOutputFileUrlRequest,
  setOutputFileUrlResponse,
} from "./types"; // remove .js for local dev

const TEMPORY_ACCESS_TOKEN = process.env.TEMPORY_ACCESS_TOKEN;
if (!TEMPORY_ACCESS_TOKEN) {
  throw new Error("TEMPORY_ACCESS_TOKEN is not set");
}

const dbName = "pairio";

const collectionNames = {
  users: "users",
  services: "services",
  serviceApps: "serviceApps",
  computeClients: "computeClients",
  jobs: "jobs",
  deletedJobs: "deletedJobs",
};

// addService handler
export const addServiceHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isAddServiceRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { serviceName, userId } = rr;
    try {
      const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(userId, gitHubAccessToken))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const service = await fetchService(serviceName);
      if (service) {
        res
          .status(500)
          .json({ error: "Service with this name already exists." });
        return;
      }
      const newService: DendroService = {
        serviceName,
        userId,
        users: [],
      };
      await insertService(newService);
      const resp: AddServiceResponse = {
        type: "addServiceResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getService handler
export const getServiceHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetServiceRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(404).json({ error: `Service not found: ${rr.serviceName}` });
        return;
      }
      const resp: GetServiceResponse = {
        type: "getServiceResponse",
        service,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getServices handler
export const getServicesHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const rr = req.body;
      if (!isGetServicesRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      const { userId } = rr;
      const services = userId
        ? await fetchServicesForUser(userId)
        : await fetchAllServices();
      const resp: GetServicesResponse = {
        type: "getServicesResponse",
        services,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// deleteService handler
export const deleteServiceHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isDeleteServiceRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(404).json({ error: `Service not found: ${rr.serviceName}` });
        return;
      }
      const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(
          service.userId,
          gitHubAccessToken,
        ))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await deleteService(rr.serviceName);
      const resp: DeleteServiceResponse = {
        type: "deleteServiceResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setServiceInfo handler
export const setServiceInfoHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isSetServiceInfoRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(404).json({ error: `Service not found: ${rr.serviceName}` });
        return;
      }
      const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!gitHubAccessToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const userId = await getUserIdForGitHubAccessToken(gitHubAccessToken);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!userIsAdminForService(service, userId)) {
        res.status(401).json({
          error: `User ${userId} is not authorized to modify this service.`,
        });
        return;
      }
      const update: { [key: string]: any } = {};
      if (rr.users !== undefined) update["users"] = rr.users;
      await updateService(rr.serviceName, update);
      const resp: SetServiceInfoResponse = {
        type: "setServiceInfoResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// addServiceApp handler
export const addServiceAppHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isAddServiceAppRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const serviceName = rr.serviceApp.serviceName;
    const service = await fetchService(serviceName);
    if (!service) {
      res.status(404).json({ error: `Service not found: ${serviceName}` });
      return;
    }
    const app = rr.serviceApp;
    const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (
      !(await authenticateUserUsingGitHubToken(
        service.userId,
        gitHubAccessToken,
      ))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      await insertServiceApp(app);
      const resp: AddServiceAppResponse = {
        type: "addServiceAppResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// addUser handler
export const addUserHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isAddUserRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (
      !(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await fetchUser(rr.userId);
    if (user !== null) {
      res.status(400).json({ error: "User already exists" });
      return;
    }
    try {
      const user: DendroUser = {
        userId: rr.userId,
        name: "",
        email: "",
        apiKey: null,
      };
      await insertUser(user);
      const resp: AddUserResponse = {
        type: "addUserResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// resetUserApiKey handler
export const resetUserApiKeyHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isResetUserApiKeyRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (
      !(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let user: DendroUser | null = await fetchUser(rr.userId);
    if (user === null) {
      user = {
        userId: rr.userId,
        name: "",
        email: "",
        apiKey: null,
      };
      await insertUser(user);
    }
    try {
      const apiKey = generateUserApiKey();
      user.apiKey = apiKey;
      await updateUser(rr.userId, { apiKey });
      const resp: ResetUserApiKeyResponse = {
        type: "resetUserApiKeyResponse",
        apiKey,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setUserInfo handler
export const setUserInfoHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isSetUserInfoRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (
      !(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const update: { [key: string]: any } = {};
      if (rr.name !== undefined) update["name"] = rr.name;
      if (rr.email !== undefined) update["email"] = rr.email;
      await updateUser(rr.userId, update);
      const resp: SetUserInfoResponse = {
        type: "setUserInfoResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// createJob handler
export const createJobHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isCreateJobRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!authorizationToken) {
        res.status(400).json({ error: "User API token must be provided" });
        return;
      }
      if (!rr.userId) {
        rr.userId = await getUserIdFromApiToken(authorizationToken);
        if (!rr.userId) {
          res.status(401).json({ error: "Unauthorized - no user for token" });
          return;
        }
      } else {
        if (
          !(await authenticateUserUsingApiToken(rr.userId, authorizationToken))
        ) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(400).json({ error: `Service not found: ${rr.serviceName}` });
        return;
      }
      if (!userIsAllowedToCreateJobsForService(service, rr.userId)) {
        res.status(401).json({
          error: "This user is not allowed to create jobs for this service",
        });
        return;
      }
      const app = await fetchServiceApp(
        rr.serviceName,
        rr.jobDefinition.appName,
      );
      if (!app) {
        res.status(400).json({
          error: `Service app not found: ${rr.jobDefinition.appName}`,
        });
        return;
      }
      try {
        validateJobDefinitionForServiceApp(rr.jobDefinition, app);
      } catch (err) {
        res.status(400).json({
          error: `Job definition is not compatible with app: ${err.message}`,
        });
        return;
      }

      const jobDefinitionNormalized = normalizeJobDefinitionForHash(
        rr.jobDefinition,
      );
      const jobDefinitionHash = computeSha1(
        JSONStringifyDeterministic(jobDefinitionNormalized),
      );

      if (!rr.skipCache) {
        const match = {
          serviceName: rr.serviceName,
          jobDefinitionHash,
        };
        const pipeline = [
          { $match: match },
          { $sort: { timestampCreatedSec: -1 } }, // get the most recent matching job
          { $limit: 1 },
        ];
        const jobs = await fetchJobs(pipeline, {
          includePrivateKey: false,
          includeSecrets: false,
        });
        if (jobs.length > 0) {
          const job = jobs[0];
          if (job.status === "failed" && rr.rerunFailing) {
            // we're not going to use this one because we are going to rerun the failed job
            if (rr.deleteFailing) {
              await deleteJobs({
                jobIds: [job.jobId],
              });
            }
          } else {
            let allTagsWereAlreadyPresentOnJob = true;
            const newTags = [...job.tags];
            for (const tag of rr.tags) {
              if (!job.tags.includes(tag)) {
                newTags.push(tag);
                allTagsWereAlreadyPresentOnJob = false;
              }
            }
            if (!allTagsWereAlreadyPresentOnJob) {
              await updateJob(job.jobId, { tags: newTags });
            }
            // notify the compute clients as though the status has changed
            await publishPubsubMessage("dendro-compute-clients", {
              type: "jobStatusChanged",
              serviceName: job.serviceName,
              jobId: job.jobId,
              status: job.status,
            });
            // double check that the  private key and the secrets are not included
            if (job.jobPrivateKey) {
              throw new Error("Unexpected: job private key should be null (1)");
            }
            if (job.secrets) {
              throw new Error("Unexpected: job secrets should be null (1)");
            }
            const resp: CreateJobResponse = {
              type: "createJobResponse",
              job,
            };
            res.status(200).json(resp);
            return;
          }
        }
      }

      const jobId = generateJobId();
      const jobPrivateKey = generateJobPrivateKey();
      const consoleOutputUrl = await createOutputFileUrl({
        serviceName: rr.serviceName,
        appName: rr.jobDefinition.appName,
        processorName: rr.jobDefinition.processorName,
        jobId,
        outputName: "console_output",
        outputFileBaseName: "output.txt",
      });
      const resourceUtilizationLogUrl = await createOutputFileUrl({
        serviceName: rr.serviceName,
        appName: rr.jobDefinition.appName,
        processorName: rr.jobDefinition.processorName,
        jobId,
        outputName: "resource_utilization_log",
        outputFileBaseName: "log.jsonl",
      });

      const outputFileResults: DendroJobOutputFileResult[] = [];
      for (const oo of rr.jobDefinition.outputFiles) {
        const ofr: DendroJobOutputFileResult = {
          name: oo.name,
          fileBaseName: oo.fileBaseName,
          url: oo.urlDeterminedAtRuntime
            ? ""
            : await createOutputFileUrl({
                serviceName: rr.serviceName,
                appName: rr.jobDefinition.appName,
                processorName: rr.jobDefinition.processorName,
                jobId,
                outputName: oo.name,
                outputFileBaseName: oo.fileBaseName,
              }),
          size: null,
        };
        outputFileResults.push(ofr);
      }

      const isRunnable = await checkJobRunnable(rr.jobDependencies);

      const job: DendroJob = {
        jobId,
        jobPrivateKey,
        serviceName: rr.serviceName,
        userId: rr.userId,
        batchId: rr.batchId,
        tags: rr.tags,
        jobDefinition: rr.jobDefinition,
        jobDefinitionHash,
        jobDependencies: rr.jobDependencies,
        requiredResources: rr.requiredResources,
        targetComputeClientIds: rr.targetComputeClientIds || null,
        secrets: rr.secrets,
        inputFileUrlList: rr.jobDefinition.inputFiles.map((f) => f.url),
        outputFileUrlList: [],
        outputFileResults,
        consoleOutputUrl,
        resourceUtilizationLogUrl,
        timestampCreatedSec: Date.now() / 1000,
        timestampStartingSec: null,
        timestampStartedSec: null,
        timestampFinishedSec: null,
        timestampUpdatedSec: Date.now() / 1000,
        canceled: false,
        status: "pending",
        isRunnable,
        error: null,
        computeClientId: null,
        computeClientName: null,
        computeClientUserId: null,
        imageUri: null,
      };
      await insertJob(job);

      await publishPubsubMessage("dendro-compute-clients", {
        type: "newPendingJob",
        serviceName: job.serviceName,
        jobId: job.jobId,
      });
      // hide the private key and the secrets
      job.jobPrivateKey = null;
      job.secrets = null;
      const resp: CreateJobResponse = {
        type: "createJobResponse",
        job,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// findJobByDefinition handler
export const findJobByDefinitionHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isFindJobByDefinitionRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const jobDefinitionNormalized = normalizeJobDefinitionForHash(
        rr.jobDefinition,
      );
      const jobDefinitionHash = computeSha1(
        JSONStringifyDeterministic(jobDefinitionNormalized),
      );
      const match = {
        serviceName: rr.serviceName,
        jobDefinitionHash,
      };
      const pipeline = [
        { $match: match },
        { $sort: { timestampCreatedSec: -1 } }, // get the most recent matching job
        { $limit: 1 },
      ];
      const jobs = await fetchJobs(pipeline, {
        includePrivateKey: false,
        includeSecrets: false,
      });
      if (jobs.length > 0) {
        const job = jobs[0];
        // double check that the  private key and the secrets are not included
        if (job.jobPrivateKey) {
          throw new Error("Unexpected: job private key should be null (2)");
        }
        if (job.secrets) {
          throw new Error("Unexpected: job secrets should be null (2)");
        }
        const resp: FindJobByDefinitionResponse = {
          type: "findJobByDefinitionResponse",
          found: true,
          job,
        };
        res.status(200).json(resp);
      } else {
        const resp: FindJobByDefinitionResponse = {
          type: "findJobByDefinitionResponse",
          found: false,
        };
        res.status(200).json(resp);
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

const checkJobRunnable = async (jobDependencies: string[]) => {
  for (const jobId of jobDependencies) {
    const job = await fetchJob(jobId, {
      includePrivateKey: false,
      includeSecrets: false,
    });
    if (!job) {
      return false;
    }
    if (job.status !== "completed") {
      return false;
    }
  }
  return true;
};

// deleteJobs handler
export const deleteJobsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isDeleteJobsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      const { userId, jobIds } = rr;
      if (!userId) {
        res.status(400).json({ error: "userId must be provided" });
        return;
      }
      if (
        !(await authenticateUserUsingGitHubToken(userId, githubAccessToken))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const pipeline = [{ $match: { jobId: { $in: jobIds } } }];
      const jobs = await fetchJobs(pipeline, {
        includePrivateKey: false,
        includeSecrets: false,
      });
      const distinctServiceNames = Array.from(
        new Set(jobs.map((j) => j.serviceName)),
      );
      for (const serviceName of distinctServiceNames) {
        const service = await fetchService(serviceName);
        if (!service) {
          res.status(404).json({ error: `Service not found: ${serviceName}` });
          return;
        }
        if (!userIsAllowedToDeleteJobsForService(service, userId)) {
          res.status(401).json({
            error: `This user is not allowed to delete jobs for service ${serviceName}`,
          });
          return;
        }
      }
      await deleteJobs({
        jobIds,
      });
      const resp: DeleteJobsResponse = {
        type: "deleteJobsResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// findJobs handler
export const findJobsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isFindJobsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      let okayToProceed = false;
      if (rr.userId) {
        okayToProceed = true;
      } else if (rr.computeClientId) {
        okayToProceed = true;
      } else if (rr.jobId) {
        okayToProceed = true;
      } else if (rr.processorName) {
        okayToProceed = true;
      } else if (rr.serviceName) {
        okayToProceed = true;
      } else if (rr.inputFileUrl) {
        okayToProceed = true;
      } else if (rr.outputFileUrl) {
        okayToProceed = true;
      } else if (rr.batchId) {
        okayToProceed = true;
      } else if (rr.tags) {
        okayToProceed = true;
      }
      if (!okayToProceed) {
        res.status(400).json({
          error: "Not enough info provided in request for query for jobs",
        });
        return;
      }
      const query: { [key: string]: any } = {};
      if (rr.userId) query["userId"] = rr.userId;
      if (rr.jobId) query["jobId"] = rr.jobId;
      if (rr.processorName)
        query["jobDefinition.processorName"] = rr.processorName;
      if (rr.computeClientId) query["computeClientId"] = rr.computeClientId;
      if (rr.batchId) query["batchId"] = rr.batchId;
      if (rr.tags) {
        // tags is a list of strings. We need documents whose tags contain all of these strings.
        query["tags"] = { $all: rr.tags };
      }
      if (rr.serviceName) query["serviceName"] = rr.serviceName;
      if (rr.appName) query["jobDefinition.appName"] = rr.appName;
      if (rr.inputFileUrl) query["inputFileUrlList"] = rr.inputFileUrl;
      if (rr.outputFileUrl) query["outputFileUrlList"] = rr.outputFileUrl;
      if (rr.status) query["status"] = rr.status;
      const pipeline: any[] = [
        { $match: query },
        { $sort: { timestampUpdatedSec: -1, timestampCreatedSec: -1 } },
      ];
      const limit = rr.limit === undefined ? 1000 : rr.limit;
      if (rr.limit) {
        pipeline.push({ $limit: limit });
      }
      const jobs = await fetchJobs(pipeline, {
        includePrivateKey: false,
        includeSecrets: false,
      });
      // double check that the  private key and the secrets are not included
      for (const job of jobs) {
        if (job.jobPrivateKey) {
          throw new Error("Unexpected: job private key should be null (3)");
        }
        if (job.secrets) {
          throw new Error("Unexpected: job secrets should be null (3)");
        }
      }
      const resp: FindJobsResponse = {
        type: "findJobsResponse",
        jobs,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getRunnableJobsForComputeClient handler
export const getRunnableJobsForComputeClientHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetRunnableJobsForComputeClientRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const computeClient: DendroComputeClient | null =
        await fetchComputeClient(rr.computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      const computeClientPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (computeClient.computeClientPrivateKey !== computeClientPrivateKey) {
        res.status(401).json({
          error:
            "Unauthorized: incorrect or missing compute client private key",
        });
        return;
      }
      await updateComputeClient(rr.computeClientId, {
        timestampLastActiveSec: Date.now() / 1000,
      });

      let runningJobs: DendroJob[];
      if (!rr.jobId || rr.singleJob) {
        const pipeline2 = [
          {
            $match: {
              status: { $in: ["running", "starting"] },
              computeClientId: rr.computeClientId,
            },
          },
          { $sort: { timestampCreatedSec: 1 } },
          // important not to limit here, because we really need to know all the running jobs
        ];
        // NOTE: include private keys
        runningJobs = await fetchJobs(pipeline2, {
          includePrivateKey: true,
          includeSecrets: false,
        });
        // double check that the private keys are included but not the secrets
        for (const job of runningJobs) {
          if (!job.jobPrivateKey) {
            throw new Error(
              "Unexpected: job private key should not be null (4)",
            );
          }
          if (job.secrets) {
            throw new Error("Unexpected: job secrets should be null (4)");
          }
        }
      } else {
        // if we are providing a jobId or we are in singleJob mode, we are not going to return the running jobs
        runningJobs = [];
      }

      // we give priority to the first services in the list
      const allRunnableReadyJobs: DendroJob[] = [];
      for (const serviceName of computeClient.serviceNames) {
        const service = await fetchService(serviceName);
        if (!service) {
          res.status(404).json({ error: `Service not found: ${serviceName}` });
          return;
        }
        if (
          !userIsAllowedToProcessJobsForService(service, computeClient.userId)
        ) {
          res.status(401).json({
            error: `This compute client is not allowed to process jobs for service: ${serviceName}`,
          });
          return;
        }
        const query: { [key: string]: any } = {
          serviceName: service.serviceName,
          status: "pending",
          isRunnable: true,
        };
        if (rr.jobId) {
          query["jobId"] = rr.jobId;
        }
        if (computeClient.processJobsForUsers) {
          // only process jobs for particular users
          query["userId"] = { $in: computeClient.processJobsForUsers };
        }
        const pipeline = [
          { $match: query },
          { $sample: { size: 100 } }, // thinking of the case of many pending jobs, but we don't want to always get the same ones (but there is a potential problem here)
          { $sort: { timestampCreatedSec: -1 } }, // handle most recent jobs first (is this what we want to do?)
        ];
        // NOTE: include private keys
        let runnableJobs = await fetchJobs(pipeline, {
          includePrivateKey: true,
          includeSecrets: false,
        });

        // Don't shuffle for now
        // // scramble the pending jobs so that we don't always get the same ones
        // // and minimize conflicts between compute clients when there are many
        // // pending jobs
        // runnableJobs = shuffleArray(runnableJobs);

        // exclude jobs that are targeting other compute clients
        runnableJobs = runnableJobs.filter((j) => {
          if (j.targetComputeClientIds) {
            return (
              j.targetComputeClientIds.includes(rr.computeClientId) ||
              j.targetComputeClientIds.includes("*")
            );
          } else {
            return false;
          }
        });
        if (!rr.jobId) {
          for (const pj of runnableJobs) {
            if (rr.singleJob && allRunnableReadyJobs.length > 0) {
              // if we are in singleJob mode, we are only going to return one job
              break;
            }
            if (
              computeResourceHasEnoughCapacityForJob(computeClient, pj, [
                ...runningJobs,
                ...allRunnableReadyJobs,
              ])
            ) {
              allRunnableReadyJobs.push(pj);
            }
          }
        } else {
          // if we are supplying a jobId, we are not going to check whether the compute client has enough capacity
          allRunnableReadyJobs.push(...runnableJobs);
        }
        // double check that the private keys are included but not the secrets
        for (const job of runnableJobs) {
          if (!job.jobPrivateKey) {
            throw new Error(
              "Unexpected: job private key should not be null (5)",
            );
          }
          if (job.secrets) {
            throw new Error("Unexpected: job secrets should be null (5)");
          }
        }
      }
      const resp: GetRunnableJobsForComputeClientResponse = {
        type: "getRunnableJobsForComputeClientResponse",
        runnableJobs: allRunnableReadyJobs,
        runningJobs,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getRunnableJob handler
export const getRunnableJobHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetRunnableJobRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!authorizationToken) {
        res.status(400).json({ error: "User API token must be provided" });
        return;
      }
      const userId = await getUserIdFromApiToken(authorizationToken);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized - no user for token" });
        return;
      }
      const job = await fetchJob(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      if (
        job.targetComputeClientIds &&
        !job.targetComputeClientIds.includes("*") &&
        job.targetComputeClientIds.length > 0
      ) {
        res
          .status(400)
          .json({
            error: "Job is targeted to be run by specific compute clients",
          });
        return;
      }
      if (job.status !== "pending") {
        res.status(400).json({ error: "Job is not pending" });
        return;
      }
      if (job.isRunnable === false) {
        res.status(400).json({ error: "Job is not runnable" });
        return;
      }
      const service = await fetchService(job.serviceName);
      if (!service) {
        res
          .status(404)
          .json({ error: `Service not found: ${job.serviceName}` });
        return;
      }
      if (!userIsAllowedToProcessJobsForService(service, userId)) {
        res.status(401).json({
          error: `This user is not allowed to process jobs for service ${job.serviceName}`,
        });
        return;
      }
      const resp: GetRunnableJobResponse = {
        type: "getRunnableJobResponse",
        job,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

const computeResourceHasEnoughCapacityForJob = (
  computeClient: DendroComputeClient,
  job: DendroJob,
  otherJobs: DendroJob[],
) => {
  const slotties = computeClient.computeSlots.map((s) => ({
    computeSlot: s,
    count: 0,
  }));
  for (const j of otherJobs) {
    for (const s of slotties) {
      if (s.count >= (s.computeSlot.multiplicity || 1)) {
        continue;
      }
      if (fitsSlot(j, s.computeSlot)) {
        s.count++;
        break;
      }
    }
  }
  for (const s of slotties) {
    if (s.count >= (s.computeSlot.multiplicity || 1)) {
      continue;
    }
    if (fitsSlot(job, s.computeSlot)) {
      return true;
    }
  }
  return false;
};

const fitsSlot = (job: DendroJob, computeSlot: ComputeClientComputeSlot) => {
  const rr = job.requiredResources;
  const cs = computeSlot;
  if (rr.numCpus > cs.numCpus) return false;
  if (rr.numGpus > cs.numGpus) return false;
  if (rr.memoryGb > cs.memoryGb) return false;
  if (rr.timeSec > cs.timeSec) return false;
  if (rr.numCpus < cs.minNumCpus) return false;
  if (rr.numGpus < cs.minNumGpus) return false;
  if (rr.memoryGb < cs.minMemoryGb) return false;
  if (rr.timeSec < cs.minTimeSec) return false;
  return true;
};

// getJob handler
export const getJobHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetJobRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      // exclude secrets, but include private key if requested
      // however, if requested we do a check below that the compute client is authorized
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: rr.includePrivateKey,
        includeSecrets: false,
      });
      if (!job) {
        // job not found
        // important to return undefined rather than returning an error
        // because we need to distinguish between a job not found and an error
        const rr: GetJobResponse = {
          type: "getJobResponse",
          job: undefined,
        };
        res.status(200).json(rr);
        return;
      }
      if (rr.includePrivateKey) {
        if (!rr.computeClientId) {
          res.status(400).json({
            error:
              "computeClientId must be provided if includePrivateKey is true",
          });
          return;
        }
        if (job.computeClientId !== rr.computeClientId) {
          res.status(401).json({
            error: "Mismatch between computeClientId in request and job",
          });
          return;
        }
        const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (
          !(await authenticateComputeClient(
            rr.computeClientId,
            authorizationToken,
          ))
        ) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      } else {
        // double check that the private key is not included
        if (job.jobPrivateKey) {
          throw new Error("Unexpected: job private key should be null (6)");
        }
      }
      // double check that the secrets are not included
      if (job.secrets) {
        throw new Error("Unexpected: job secrets should be null (6)");
      }
      const resp: GetJobResponse = {
        type: "getJobResponse",
        job,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// cancelJob handler
export const cancelJobHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isCancelJobRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: false,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingApiToken(job.userId, authorizationToken))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (job.status === "completed" || job.status === "failed") {
        res.status(400).json({ error: "Job is already completed or failed" });
        return;
      }
      await updateJob(rr.jobId, { canceled: true });
      const resp: CancelJobResponse = {
        type: "cancelJobResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setJobStatus handler
export const setJobStatusHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isSetJobStatusRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      const job = await fetchJob(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(401).json({
          error: "Unauthorized: incorrect or missing job private key",
        });
        return;
      }
      const computeClientId = rr.computeClientId;
      let computeClientUserId: string | null = null;
      let computeClient: DendroComputeClient | null = null;
      if (computeClientId) {
        computeClient = await fetchComputeClient(computeClientId);
        if (!computeClient) {
          res.status(404).json({ error: "Compute client not found" });
          return;
        }
        computeClientUserId = computeClient.userId;
      }
      if (computeClientId) {
        if (job.computeClientId) {
          if (job.computeClientId !== computeClientId) {
            res.status(401).json({
              error: "Mismatch between computeClientId in request and job",
            });
            return;
          }
        } else {
          if (job.status !== "pending") {
            res.status(400).json({
              error:
                "Job is not in pending status and the compute client is not set",
            });
            return;
          }
          if (rr.status !== "starting") {
            res.status(400).json({
              error:
                "Trying to set job to a status other than starting when compute client is not set",
            });
            return;
          }
        }
      }
      if (rr.status === "starting") {
        if (job.status !== "pending") {
          res.status(400).json({
            error: `Trying to start job. Job is not in pending status. Status is ${job.status}`,
          });
          return;
        }
        const service = await fetchService(job.serviceName);
        if (!service) {
          res
            .status(404)
            .json({ error: `Service not found: ${job.serviceName}` });
          return;
        }
        if (
          computeClientUserId &&
          !userIsAllowedToProcessJobsForService(service, computeClientUserId)
        ) {
          res.status(401).json({
            error:
              "This compute client is not allowed to process jobs for this service",
          });
          return;
        }
        await atomicUpdateJob(rr.jobId, "pending", {
          status: "starting",
          computeClientId,
          computeClientName: computeClient
            ? computeClient.computeClientName
            : "",
          computeClientUserId,
          timestampStartingSec: Date.now() / 1000,
          timestampUpdatedSec: Date.now() / 1000,
        });
      } else if (rr.status === "running") {
        if (job.status !== "starting") {
          res.status(400).json({ error: "Job is not in starting status" });
          return;
        }
        await atomicUpdateJob(rr.jobId, "starting", {
          status: "running",
          timestampStartedSec: Date.now() / 1000,
          timestampUpdatedSec: Date.now() / 1000,
        });
      } else if (rr.status === "completed" || rr.status === "failed") {
        if (rr.status === "completed") {
          if (job.status !== "running") {
            res.status(400).json({ error: "Job is not in running status" });
            return;
          }
          if (rr.error) {
            res
              .status(400)
              .json({ error: "Error should not be set for completed job" });
            return;
          }
        } else if (rr.status === "failed") {
          if (!["running", "starting", "pending"].includes(job.status)) {
            res
              .status(400)
              .json({ error: `Invalid status for failed job: ${job.status}` });
            return;
          }
          if (!rr.error) {
            res.status(400).json({ error: "Error must be set for failed job" });
            return;
          }
        }
        await updateJob(rr.jobId, {
          status: rr.status,
          error: rr.error,
          timestampFinishedSec: Date.now() / 1000,
          timestampUpdatedSec: Date.now() / 1000,
        });
        if (rr.status === "completed") {
          // maybe some other jobs have become runnable
          const pipeline = [
            {
              $match: {
                jobDependencies: rr.jobId,
                status: "pending",
                isRunnable: false,
              },
            },
            // do not limit
          ];
          const jobsThatMayHaveBecomeRunnable = await fetchJobs(pipeline, {
            includePrivateKey: false,
            includeSecrets: false,
          });
          for (const j of jobsThatMayHaveBecomeRunnable) {
            const nowRunnable = await checkJobRunnable(j.jobDependencies);
            if (nowRunnable) {
              await updateJob(j.jobId, { isRunnable: true });
              await publishPubsubMessage("dendro-compute-clients", {
                type: "jobStatusChanged",
                serviceName: j.serviceName,
                jobId: j.jobId,
                status: j.status,
              });
            }
          }
        }
        if (rr.status === "completed") {
          // set the outputFileUrlList
          const uploadFileUrlList: string[] = [];
          for (const oo of job.outputFileResults) {
            uploadFileUrlList.push(oo.url);
          }
          for (const oo of job.otherFileOutputs || []) {
            uploadFileUrlList.push(oo.url);
          }
          await updateJob(rr.jobId, { outputFileUrlList: uploadFileUrlList });
        }
      } else {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      await publishPubsubMessage("dendro-compute-clients", {
        type: "jobStatusChanged",
        serviceName: job.serviceName,
        jobId: job.jobId,
        status: rr.status,
      });
      const resp: SetJobStatusResponse = {
        type: "setJobStatusResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getSignedUploadUrl handler
export const getSignedUploadUrlHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetSignedUploadUrlRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(401).json({
          error: "Unauthorized: incorrect or missing job private key",
        });
        return;
      }
      let url: string;
      if (rr.uploadType === "output") {
        if (!rr.outputName) {
          res.status(400).json({ error: "Must specify outputName" });
          return;
        }
        const oo = job.jobDefinition.outputFiles.find(
          (o) => o.name === rr.outputName,
        );
        if (!oo) {
          res.status(400).json({ error: "Output file not found" });
          return;
        }
        const ooResult = job.outputFileResults.find(
          (o) => o.name === rr.outputName,
        );
        if (!ooResult) {
          res.status(400).json({ error: "Output file result not found" });
          return;
        }
        url = ooResult.url;

        // set the size of the output file result
        ooResult.size = rr.size;
        await updateJob(rr.jobId, { outputFileResults: job.outputFileResults });
      } else if (rr.uploadType === "consoleOutput") {
        url = job.consoleOutputUrl;
      } else if (rr.uploadType === "resourceUtilizationLog") {
        url = job.resourceUtilizationLogUrl;
      } else if (rr.uploadType === "other") {
        if (!rr.otherName) {
          res.status(400).json({ error: "Must specify otherName" });
          return;
        }
        if (!isValidOtherName(rr.otherName)) {
          res.status(400).json({ error: "Invalid otherName" });
          return;
        }
        if (rr.size > 1024 * 1024 * 1024 + 10) {
          res.status(400).json({ error: "File size too large" });
          return;
        }
        const oo = (job.otherFileOutputs || []).find(
          (o) => o.name === rr.otherName,
        );
        if (oo) {
          res.status(400).json({ error: "Other file already exists" });
        }
        const otherFileUrl = await createOtherFileUrl({
          serviceName: job.serviceName,
          appName: job.jobDefinition.appName,
          processorName: job.jobDefinition.processorName,
          jobId: job.jobId,
          otherName: rr.otherName,
        });
        job.otherFileOutputs = [
          ...(job.otherFileOutputs || []),
          { name: rr.otherName, url: otherFileUrl },
        ];
        await updateJob(rr.jobId, { otherFileOutputs: job.otherFileOutputs });
        url = otherFileUrl;
      } else {
        res.status(400).json({ error: "Invalid uploadType" });
        return;
      }
      if (rr.size < 1024 * 1024 * 1000) {
        const signedUrl = await createSignedUploadUrl({
          url,
          size: rr.size,
          userId: job.userId,
        });
        const resp: GetSignedUploadUrlResponse = {
          type: "getSignedUploadUrlResponse",
          signedUrl,
          downloadUrl: url,
        };
        res.status(200).json(resp);
      } else {
        const numParts = Math.ceil(rr.size / (1024 * 1024 * 1000));
        const { parts, uploadId } = await initiateMultipartUpload({
          url,
          size: rr.size,
          userId: job.userId,
          numParts,
        });
        const resp: GetSignedUploadUrlResponse = {
          type: "getSignedUploadUrlResponse",
          parts,
          uploadId,
          downloadUrl: url,
        };
        res.status(200).json(resp);
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

export const finalizeMultipartUploadHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isFinalizeMultipartUploadRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(401).json({
          error: "Unauthorized: incorrect or missing job private key",
        });
        return;
      }
      const url = rr.url;
      const uploadId = rr.uploadId;
      const parts = rr.parts;
      const size = rr.size;
      const userId = job.userId;
      await finalizeMultipartUpload({ url, uploadId, parts, size, userId });
      const resp: FinalizeMultipartUploadResponse = {
        type: "finalizeMultipartUploadResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

export const cancelMultipartUploadHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isCancelMultipartUploadRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: false,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(401).json({
          error: "Unauthorized: incorrect or missing job private key",
        });
        return;
      }
      const url = rr.url;
      const uploadId = rr.uploadId;
      await cancelMultipartUpload({ url, uploadId });
      const resp: CancelMultipartUploadResponse = {
        type: "cancelMultipartUploadResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getSignedDownloadUrl handler
export const getSignedDownloadUrlHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetSignedDownloadUrlRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const job = await fetchOneJobByJobId(rr.jobId, {
        includePrivateKey: true,
        includeSecrets: true,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(401).json({
          error: "Unauthorized: incorrect or missing job private key",
        });
        return;
      }

      const url = rr.url;
      let found = false;
      for (const x of job.jobDefinition.inputFiles) {
        if (x.url === url) {
          found = true;
          break;
        }
      }
      if (!found) {
        res.status(500).json({
          error:
            "Cannot generate signed download URL. No input file with this URL in job.",
        });
      }
      let signedUrl = url;
      if (
        signedUrl.startsWith("https://api.dandiarchive.org/api/") ||
        signedUrl.startsWith("https://api-staging.dandiarchive.org/api/")
      ) {
        const s = job.secrets?.find((s) => s.name === "DANDI_API_KEY");
        const DANDI_API_KEY = s ? s.value : undefined;
        signedUrl = await resolveDandiUrl(url, { dandiApiKey: DANDI_API_KEY });
      }
      const resp: GetSignedDownloadUrlResponse = {
        type: "getSignedDownloadUrlResponse",
        signedUrl,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

const resolveDandiUrl = async (
  url: string,
  options: { dandiApiKey?: string },
) => {
  const headers: { [key: string]: string } = {};
  if (options.dandiApiKey) {
    headers["Authorization"] = `token ${options.dandiApiKey}`;
  }
  const resp = await fetch(url, {
    method: "HEAD",
    headers,
    redirect: "follow",
  });
  return resp.url;
};

// deleteComputeClient handler
export const deleteComputeClientHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isDeleteComputeClientRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const computeClient = await fetchComputeClient(rr.computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(
          computeClient.userId,
          gitHubAccessToken,
        ))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await deleteComputeClient(rr.computeClientId);
      const resp: DeleteComputeClientResponse = {
        type: "deleteComputeClientResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// createComputeClient handler
export const createComputeClientHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isCreateComputeClientRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (
      !(await authenticateUserUsingGitHubToken(rr.userId, gitHubAccessToken))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const computeClient: DendroComputeClient = {
      userId: rr.userId,
      serviceNames: rr.serviceNames,
      computeClientId: generateComputeClientId(),
      computeClientPrivateKey: generateComputeClientPrivateKey(),
      computeClientName: rr.computeClientName,
      description: "",
      computeSlots: [
        {
          numCpus: 4,
          numGpus: 0,
          memoryGb: 8,
          timeSec: 3600,
          minNumCpus: 0,
          minNumGpus: 0,
          minMemoryGb: 0,
          minTimeSec: 0,
          multiplicity: 1,
        },
      ],
    };
    try {
      await insertComputeClient(computeClient);
      const resp: CreateComputeClientResponse = {
        type: "createComputeClientResponse",
        computeClientId: computeClient.computeClientId,
        computeClientPrivateKey: computeClient.computeClientPrivateKey || "", // should not be null
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getComputeClient handler
export const getComputeClientHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetComputeClientRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const computeClient = await fetchComputeClient(rr.computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      // hide the private key
      computeClient.computeClientPrivateKey = null;
      const resp: GetComputeClientResponse = {
        type: "getComputeClientResponse",
        computeClient,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getComputeClients handler
export const getComputeClientsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetComputeClientsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      if (rr.serviceName) {
        const computeClients = await fetchComputeClientsForService(
          rr.serviceName,
        );
        // hide the private keys
        for (const computeClient of computeClients) {
          computeClient.computeClientPrivateKey = null;
        }
        const resp: GetComputeClientsResponse = {
          type: "getComputeClientsResponse",
          computeClients,
        };
        res.status(200).json(resp);
      } else {
        res.status(400).json({ error: "Must specify serviceName in request" });
        return;
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setComputeClientInfo handler
export const setComputeClientInfoHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isSetComputeClientInfoRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const computeClient = await fetchComputeClient(rr.computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(
          computeClient.userId,
          gitHubAccessToken,
        ))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const update: { [key: string]: any } = {};
      if (rr.computeClientName !== undefined)
        update["computeClientName"] = rr.computeClientName;
      if (rr.description !== undefined) update["description"] = rr.description;
      if (rr.computeSlots !== undefined)
        update["computeSlots"] = rr.computeSlots;
      if (rr.serviceNames !== undefined) {
        for (const serviceName of rr.serviceNames) {
          const service: DendroService | null = await fetchService(serviceName);
          if (!service) {
            res.status(404).json({ error: `Service ${serviceName} not found` });
            return;
          }
          if (
            !userIsAllowedToProcessJobsForService(service, computeClient.userId)
          ) {
            res.status(401).json({
              error: `This compute client is not allowed to process jobs for service: ${serviceName}`,
            });
            return;
          }
        }
        update["serviceNames"] = rr.serviceNames;
      }
      if (rr.processJobsForUsers !== undefined) {
        if (rr.processJobsForUsers === null) {
          update["processJobsForUsers"] = null;
        } else {
          update["processJobsForUsers"] = rr.processJobsForUsers;
        }
      }
      // check if there is something to update
      if (Object.keys(update).length === 0) {
        res.status(400).json({ error: "Nothing to update" });
        return;
      }
      await updateComputeClient(rr.computeClientId, update);
      const resp: SetComputeClientInfoResponse = {
        type: "setComputeClientInfoResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setServiceAppInfo handler
export const setServiceAppInfoHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isSetServiceAppInfoRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(404).json({ error: `Service ${rr.serviceName} not found` });
        return;
      }
      const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(
          service.userId,
          githubAccessToken,
        ))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const update: { [key: string]: any } = {};
      if (rr.appSpecificationUri !== undefined)
        update["appSpecificationUri"] = rr.appSpecificationUri;
      if (rr.appSpecificationCommit !== undefined)
        update["appSpecificationCommit"] = rr.appSpecificationCommit;
      if (rr.appSpecification !== undefined)
        update["appSpecification"] = rr.appSpecification;
      await updateServiceApp(rr.serviceName, rr.appName, update);
      const resp: SetServiceAppInfoResponse = {
        type: "setServiceAppInfoResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getServiceApp handler
export const getServiceAppHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetServiceAppRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const app = await fetchServiceApp(rr.serviceName, rr.appName);
      if (!app) {
        res.status(404).json({ error: "App not found" });
        return;
      }
      const resp: GetServiceAppResponse = {
        type: "getServiceAppResponse",
        serviceApp: app,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// deleteServiceApp handler
export const deleteServiceAppHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isDeleteServiceAppRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const service = await fetchService(rr.serviceName);
      if (!service) {
        res.status(404).json({ error: `Service ${rr.serviceName} not found` });
        return;
      }
      const gitHubAuthorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (
        !(await authenticateUserUsingGitHubToken(
          service.userId,
          gitHubAuthorizationToken,
        ))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const app = await fetchServiceApp(rr.serviceName, rr.appName);
      if (!app) {
        res.status(404).json({ error: `App ${rr.appName} not found` });
        return;
      }
      await deleteServiceApp(rr.serviceName, rr.appName);
      const resp: DeleteServiceAppResponse = {
        type: "deleteServiceAppResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getServiceApps handler
export const getServiceAppsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const rr = req.body;
    if (!isGetServiceAppsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      if (rr.appName) {
        if (rr.serviceName) {
          res.status(400).json({
            error: "Cannot specify both appName and serviceName in request",
          });
          return;
        }
        const apps = await fetchServiceAppsForAppName(rr.appName);
        const resp: GetServiceAppsResponse = {
          type: "getServiceAppsResponse",
          serviceApps: apps,
        };
        res.status(200).json(resp);
      } else if (rr.serviceName) {
        const apps = await fetchServiceAppsForServiceName(rr.serviceName);
        const resp: GetServiceAppsResponse = {
          type: "getServiceAppsResponse",
          serviceApps: apps,
        };
        res.status(200).json(resp);
      } else {
        res.status(400).json({
          error: "Must specify either appName or serviceName in request",
        });
        return;
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getPubsubSubscription handler
export const getPubsubSubscriptionHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetPubsubSubscriptionRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const { computeClientId } = rr;
      const protocolVersion = rr.protocolVersion || "old"; // by default use "old" because the old dendro compute clients do not send the protocolVersion
      if (!computeClientId) {
        res
          .status(400)
          .json({ error: "Must specify computeClientId in request" });
        return;
      }
      const computeClientPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      const computeClient = await fetchComputeClient(computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      if (computeClient.computeClientPrivateKey !== computeClientPrivateKey) {
        res.status(401).json({
          error:
            "Unauthorized: incorrect or missing compute client private key",
        });
        return;
      }
      await updateComputeClient(computeClientId, {
        timestampLastActiveSec: Date.now() / 1000,
      });
      if (protocolVersion === "old") {
        const VITE_PUBNUB_SUBSCRIBE_KEY = process.env.VITE_PUBNUB_SUBSCRIBE_KEY;
        if (!VITE_PUBNUB_SUBSCRIBE_KEY) {
          res.status(500).json({ error: "VITE_PUBNUB_SUBSCRIBE_KEY not set" });
          return;
        }
        const resp: GetPubsubSubscriptionResponse = {
          type: "getPubsubSubscriptionResponse",
          subscription: {
            pubnubSubscribeKey: VITE_PUBNUB_SUBSCRIBE_KEY,
            pubnubChannel: "dendro-compute-clients", // cannot do this by service because we want to allow compute clients to subscribe to multiple services
            pubnubUser: computeClientId,
          },
        };
        res.status(200).json(resp);
      } else if (protocolVersion === "1") {
        const EPHEMERI_PUBSUB_URL = process.env.EPHEMERI_PUBSUB_URL;
        if (!EPHEMERI_PUBSUB_URL) {
          res.status(500).json({ error: "EPHEMERI_PUBSUB_URL not set" });
          return;
        }
        const EPHEMERI_PUBSUB_API_KEY = process.env.EPHEMERI_PUBSUB_API_KEY;
        if (!EPHEMERI_PUBSUB_API_KEY) {
          res.status(500).json({ error: "EPHEMERI_PUBSUB_API_KEY not set" });
          return;
        }
        const channels = computeClient.serviceNames.map(
          (serviceName) => `dendro-service.${serviceName}`,
        );
        const subscribeTokenObject: SubscribeTokenObject = {
          timestamp: Date.now(),
          channels,
        };
        const subscribeToken = JSON.stringify(subscribeTokenObject);
        const ephemeriPubsubSubscribeRequest: SubscribeRequest = {
          type: "subscribeRequest",
          subscribeToken,
          tokenSignature: computeSha1(subscribeToken + EPHEMERI_PUBSUB_API_KEY),
          channels,
        };
        const resp: GetPubsubSubscriptionResponse = {
          type: "getPubsubSubscriptionResponse",
          subscription: {
            pubnubSubscribeKey: undefined,
            pubnubChannel: undefined,
            pubnubUser: undefined,
            ephemeriPubsubUrl: EPHEMERI_PUBSUB_URL,
            ephemeriPubsubSubscribeRequest,
          },
        };
        res.status(200).json(resp);
      } else {
        res.status(400).json({ error: "Invalid protocolVersion" });
        return;
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// pingComputeClients handler
export const pingComputeClientsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isPingComputeClientsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const serviceName = rr.serviceName;
      const msg = {
        type: "pingComputeClients",
        serviceName,
      };
      await publishPubsubMessage("dendro-compute-clients", msg);
      const resp: PingComputeClientsResponse = {
        type: "pingComputeClientsResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

////////////////////////////////////////

const authenticateUserUsingApiToken = async (
  userId: string,
  authorizationToken: string | undefined,
): Promise<boolean> => {
  const user = await fetchUser(userId);
  if (!user) return false;
  if (user.apiKey !== authorizationToken) return false;
  return true;
};

const getUserIdFromApiToken = async (
  authorizationToken: string,
): Promise<string> => {
  const user = await fetchUserForApiToken(authorizationToken);
  if (!user) return "";
  return user.userId;
};

const authenticateUserUsingGitHubToken = async (
  userId: string,
  gitHubAccessToken: string | undefined,
): Promise<boolean> => {
  if (!gitHubAccessToken) return false;
  const githubUserId = await getUserIdForGitHubAccessToken(gitHubAccessToken);
  return userId === githubUserId;
};

const fetchService = async (
  serviceName: string,
): Promise<DendroService | null> => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  const service = await collection.findOne({ serviceName });
  if (!service) return null;
  removeMongoId(service);
  if (!isDendroService(service)) {
    throw Error("Invalid service in database");
  }
  return service;
};

const fetchServicesForUser = async (
  userId: string,
): Promise<DendroService[]> => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  const services = await collection.find({ userId }).toArray();
  for (const service of services) {
    removeMongoId(service);
    if (!isDendroService(service)) {
      throw Error("Invalid service in database");
    }
  }
  return services.map((service: any) => service as DendroService);
};

const fetchAllServices = async (): Promise<DendroService[]> => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  const services = await collection.find({}).toArray();
  for (const service of services) {
    removeMongoId(service);
    if (!isDendroService(service)) {
      throw Error("Invalid service in database");
    }
  }
  return services.map((service: any) => service as DendroService);
};

const insertService = async (service: DendroService) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  await collection.updateOne(
    { serviceName: service.serviceName },
    { $setOnInsert: service },
    { upsert: true },
  );
};

const deleteService = async (serviceName: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  await collection.deleteOne({ serviceName });
};

const updateService = async (serviceName: string, update: any) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.services);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // just need to set it to something
    } else {
      updateSet[key] = update[key];
    }
  }
  await collection.updateOne(
    { serviceName },
    { $set: updateSet, $unset: updateUnset },
  );
};

const fetchUser = async (userId: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.users);
  const user = await collection.findOne({ userId });
  if (!user) return null;
  removeMongoId(user);
  if (!isDendroUser(user)) {
    throw Error("Invalid user in database");
  }
  return user;
};

const fetchUserForApiToken = async (apiKey: string) => {
  if (!apiKey) return null;
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.users);
  const user = await collection.findOne({ apiKey });
  if (!user) return null;
  removeMongoId(user);
  if (!isDendroUser(user)) {
    throw Error("Invalid user in database");
  }
  return user;
};

const insertUser = async (user: DendroUser) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.users);
  await collection.updateOne(
    { userId: user.userId },
    { $setOnInsert: user },
    { upsert: true },
  );
};

const updateUser = async (userId: string, update: any) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.users);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // just need to set it to something
    } else {
      updateSet[key] = update[key];
    }
  }
  await collection.updateOne(
    { userId },
    { $set: updateSet, $unset: updateUnset },
  );
};

const insertServiceApp = async (app: DendroServiceApp) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  await collection.insertOne(app);
};

const fetchServiceApp = async (serviceName: string, appName: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  const app = await collection.findOne({ serviceName, appName });
  if (!app) return null;
  removeMongoId(app);
  if (!isDendroServiceApp(app)) {
    console.warn("invalid app:", app);
    await collection.deleteOne({
      serviceName: app.serviceName,
      appName: app.appName,
    });
    throw Error("Invalid service app in database");
  }
  return app;
};

const fetchServiceAppsForAppName = async (appName: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  const apps = await collection.find({ appName }).toArray();
  for (const app of apps) {
    removeMongoId(app);
    if (!isDendroServiceApp(app)) {
      throw Error("Invalid service app in database");
    }
  }
  return apps.map((app: any) => app as DendroServiceApp);
};

const fetchServiceAppsForServiceName = async (serviceName: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  const apps = await collection.find({ serviceName }).toArray();
  for (const app of apps) {
    removeMongoId(app);
    if (!isDendroServiceApp(app)) {
      throw Error("Invalid service app in database");
    }
  }
  return apps.map((app: any) => app as DendroServiceApp);
};

const updateServiceApp = async (
  serviceName: string,
  appName: string,
  update: any,
) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // just need to set it to something
    } else {
      updateSet[key] = update[key];
    }
  }
  await collection.updateOne(
    { serviceName, appName },
    { $set: updateSet, $unset: updateUnset },
  );
};

const deleteServiceApp = async (serviceName: string, appName: string) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.serviceApps);
  await collection.deleteOne({ serviceName, appName });
};

const fetchJob = async (
  jobId: string,
  o: { includeSecrets: boolean; includePrivateKey: boolean },
): Promise<DendroJob | null> => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  const job = await collection.findOne({ jobId });
  if (!job) return null;
  removeMongoId(job);
  if (!isDendroJob(job)) {
    console.warn("invalid job:", job);
    await collection.deleteOne({ jobId: job.jobId });
    throw Error("Invalid job in database");
  }
  if (!o.includeSecrets) {
    job.secrets = null;
  }
  if (!o.includePrivateKey) {
    job.jobPrivateKey = null;
  }
  return job;
};

const fetchJobs = async (
  pipeline: any[] | undefined,
  o: { includeSecrets: boolean; includePrivateKey: boolean },
) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  const jobs = await collection.aggregate(pipeline).toArray();
  for (const job of jobs) {
    removeMongoId(job);
    if (!isDendroJob(job)) {
      console.warn("invalid job:", job);
      await collection.deleteOne({ jobId: job.jobId });
      throw Error("Invalid job in database");
    }
    if (!o.includeSecrets) {
      job.secrets = null;
    }
    if (!o.includePrivateKey) {
      job.jobPrivateKey = null;
    }
  }
  return jobs.map((job: any) => job as DendroJob);
};

const fetchDeletedJobs = async (pipeline: any[] | undefined) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.deletedJobs);
  const jobs = await collection.aggregate(pipeline).toArray();
  for (const job of jobs) {
    removeMongoId(job);
    if (!isDendroJob(job)) {
      console.warn("invalid job:", job);
      await collection.deleteOne({ jobId: job.jobId });
      throw Error("Invalid job in database");
    }
  }
  return jobs.map((job: any) => job as DendroJob);
};

const fetchOneJobByJobId = async (
  jobId: string,
  o: { includeSecrets: boolean; includePrivateKey: boolean },
): Promise<DendroJob | null> => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  const job = await collection.findOne({ jobId });
  if (!job) return null;
  removeMongoId(job);
  if (!isDendroJob(job)) {
    console.warn("invalid job:", job);
    await collection.deleteOne({ jobId: job.jobId });
    throw Error("Invalid job in database");
  }
  if (!o.includeSecrets) {
    job.secrets = null;
  }
  if (!o.includePrivateKey) {
    job.jobPrivateKey = null;
  }
  return job;
};

const updateJob = async (jobId: string, update: any) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // just need to set it to something
    } else {
      updateSet[key] = update[key];
    }
  }
  await collection.updateOne(
    {
      jobId,
    },
    {
      $set: updateSet,
      $unset: updateUnset,
    },
  );
};

const atomicUpdateJob = async (
  jobId: string,
  oldStatus: string,
  update: any,
) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // just need to set it to something
    } else {
      updateSet[key] = update[key];
    }
  }
  // QUESTION: is this going to be atomic?
  // Like if two requests come in at the same time, will one of them fail?
  const result = await collection.updateOne(
    {
      jobId,
      status: oldStatus,
    },
    {
      $set: updateSet,
      $unset: updateUnset,
    },
  );
  if (result.modifiedCount !== 1) {
    throw Error("Failed to update job");
  }
};

const insertJob = async (job: DendroJob) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);
  await collection.insertOne(job);
  removeMongoId(job);
};

const deleteJobs = async (o: { jobIds: string[] }) => {
  const client = await getMongoClient();
  const collection = client.db(dbName).collection(collectionNames.jobs);

  // move the jobs to the deleted jobs collection so we can still get stats on them
  const collectionDeletedJobs = client
    .db(dbName)
    .collection(collectionNames.deletedJobs);
  const jobs = await collection.find({ jobId: { $in: o.jobIds } }).toArray();
  for (const job of jobs) {
    if (job.status !== "pending") {
      // don't save the pending jobs, because those won't count against the quotas
      await collectionDeletedJobs.insertOne(job);
    }
  }

  await collection.deleteMany({ jobId: { $in: o.jobIds } });
};

const insertComputeClient = async (computeClient: DendroComputeClient) => {
  const client = await getMongoClient();
  const collection = client
    .db(dbName)
    .collection(collectionNames.computeClients);
  await collection.insertOne(computeClient);
};

const fetchComputeClient = async (computeClientId: string) => {
  const client = await getMongoClient();
  const collection = client
    .db(dbName)
    .collection(collectionNames.computeClients);
  const computeClient = await collection.findOne({ computeClientId });
  if (!computeClient) return null;
  removeMongoId(computeClient);
  if (!isDendroComputeClient(computeClient)) {
    await collection.deleteOne({ computeClientId });
    throw Error("Invalid compute client in database");
  }
  return computeClient;
};

const fetchComputeClientsForService = async (serviceName: string) => {
  const client = await getMongoClient();
  const collection = client
    .db(dbName)
    .collection(collectionNames.computeClients);
  const computeClients = await collection
    .find({ serviceNames: serviceName })
    .toArray();
  for (const computeClient of computeClients) {
    removeMongoId(computeClient);
    if (!isDendroComputeClient(computeClient)) {
      await collection.deleteOne({
        computeClientId: computeClient.computeClientId,
      });
      throw Error("Invalid compute client in database");
    }
  }
  return computeClients.map(
    (computeClient: any) => computeClient as DendroComputeClient,
  );
};

const deleteComputeClient = async (computeClientId: string) => {
  const client = await getMongoClient();
  const collection = client
    .db(dbName)
    .collection(collectionNames.computeClients);
  await collection.deleteOne({ computeClientId });
};

const updateComputeClient = async (computeClientId: string, update: any) => {
  const client = await getMongoClient();
  const collection = client
    .db(dbName)
    .collection(collectionNames.computeClients);
  // we want undefined values to be unset
  const updateSet: { [key: string]: any } = {};
  const updateUnset: { [key: string]: any } = {};
  for (const key in update) {
    if (update[key] === undefined) {
      updateUnset[key] = ""; // any value works, it just needs the key present
    } else {
      updateSet[key] = update[key];
    }
  }
  await collection.updateOne(
    { computeClientId },
    { $set: updateSet, $unset: updateUnset },
  );
};

const authenticateComputeClient = async (
  computeClientId: string,
  authorizationToken: string | undefined,
): Promise<boolean> => {
  const computeClient = await fetchComputeClient(computeClientId);
  if (!computeClient) return false;
  if (computeClient.computeClientPrivateKey !== authorizationToken)
    return false;
  return true;
};

const removeMongoId = (x: any) => {
  if (x === null) return;
  if (typeof x !== "object") return;
  if ("_id" in x) delete x["_id"];
};

const gitHubUserIdCache: { [accessToken: string]: string } = {};
const getUserIdForGitHubAccessToken = async (gitHubAccessToken: string) => {
  if (gitHubUserIdCache[gitHubAccessToken]) {
    return gitHubUserIdCache[gitHubAccessToken];
  }

  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${gitHubAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user id");
  }

  const data = await response.json();
  const userId = "github|" + data.login;
  gitHubUserIdCache[gitHubAccessToken] = userId;
  return userId;
};

const generateUserApiKey = () => {
  return generateRandomId(32);
};

const generateRandomId = (len: number) => {
  const choices =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const numChoices = choices.length;
  let ret = "";
  for (let i = 0; i < len; i++) {
    ret += choices[Math.floor(Math.random() * numChoices)];
  }
  return ret;
};

const generateComputeClientId = () => {
  return generateRandomId(12);
};

const generateComputeClientPrivateKey = () => {
  return generateRandomId(32);
};

const createSignedUploadUrl = async (o: {
  url: string;
  size: number;
  userId: string;
}) => {
  const { url, size, userId } = o;
  const prefix = `https://tempory.net/f/dendro/`;
  if (!url.startsWith(prefix)) {
    throw Error("Invalid url. Does not have proper prefix");
  }
  const filePath = url.slice(prefix.length);
  const temporyApiUrl = "https://hub.tempory.net/api/uploadFile";
  const response = await fetch(temporyApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEMPORY_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      appName: "dendro",
      filePath,
      size,
      userId,
    }),
  });
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const result = await response.json();
  const { uploadUrl, downloadUrl } = result;
  if (downloadUrl !== url) {
    throw Error("Mismatch between download url and url");
  }
  return uploadUrl;
};

const initiateMultipartUpload = async (o: {
  url: string;
  size: number;
  userId: string;
  numParts: number;
}) => {
  const { url, numParts } = o;
  const prefix = `https://tempory.net/f/dendro/`;
  if (!url.startsWith(prefix)) {
    throw Error("Invalid url. Does not have proper prefix");
  }
  const filePath = url.slice(prefix.length);
  const temporaryApiUrl = "https://hub.tempory.net/api/initiateMultipartUpload";
  const response = await fetch(temporaryApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEMPORY_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      appName: "dendro",
      filePath,
    }),
  });
  if (!response.ok) {
    throw Error(`Failed to initiate multipart upload: ${response.statusText}`);
  }
  const result = await response.json();
  const { success, uploadId } = result;
  if (!success) {
    throw Error("Failed to initiate multipart upload. No success");
  }
  const temporaryApiUrl2 = "https://hub.tempory.net/api/uploadFileParts";
  const partNumbers: number[] = [];
  for (let i = 1; i <= numParts; i++) {
    partNumbers.push(i);
  }
  const response2 = await fetch(temporaryApiUrl2, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEMPORY_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      appName: "dendro",
      filePath,
      partNumbers,
      uploadId,
    }),
  });
  if (!response2.ok) {
    throw Error("Failed to upload file parts");
  }
  const result2 = await response2.json();
  const { success: success2, uploadUrls } = result2;
  if (!success2) {
    throw Error("Failed to upload file parts");
  }
  const parts: { partNumber: number; signedUrl: string }[] = [];
  for (let i = 0; i < numParts; i++) {
    parts.push({
      partNumber: i + 1,
      signedUrl: uploadUrls[i],
    });
  }
  return { uploadId, parts };
};

const finalizeMultipartUpload = async (o: {
  url: string;
  uploadId: string;
  parts: { PartNumber: number; ETag: string }[];
  userId: string;
  size: number;
}) => {
  const { url, uploadId, parts, userId, size } = o;
  const prefix = `https://tempory.net/f/dendro/`;
  if (!url.startsWith(prefix)) {
    throw Error("Invalid url. Does not have proper prefix");
  }
  const filePath = url.slice(prefix.length);
  const temporaryApiUrl = "https://hub.tempory.net/api/finalizeMultipartUpload";
  const response = await fetch(temporaryApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEMPORY_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      appName: "dendro",
      filePath,
      size,
      userId,
      uploadId,
      parts,
    }),
  });
  if (!response.ok) {
    throw Error("Failed to finalize multipart upload");
  }
  const result = await response.json();
  const { success } = result;
  if (!success) {
    throw Error("Failed to finalize multipart upload");
  }
  return { success };
};

const cancelMultipartUpload = async (o: { url: string; uploadId: string }) => {
  const { url, uploadId } = o;
  const prefix = `https://tempory.net/f/dendro/`;
  if (!url.startsWith(prefix)) {
    throw Error("Invalid url. Does not have proper prefix");
  }
  const filePath = url.slice(prefix.length);
  const temporaryApiUrl = "https://hub.tempory.net/api/cancelMultipartUpload";
  const response = await fetch(temporaryApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEMPORY_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      appName: "dendro",
      filePath,
      uploadId,
    }),
  });
  if (!response.ok) {
    throw Error("Failed to cancel multipart upload");
  }
  const result = await response.json();
  const { success } = result;
  if (!success) {
    throw Error("Failed to cancel multipart upload");
  }
  return { success };
};

const userIsAllowedToProcessJobsForService = (
  service: DendroService,
  userId: string,
) => {
  if (service.userId === userId) return true;
  const u = service.users.find((u) => u.userId === userId);
  if (!u) return false;
  return u.processJobs;
};

const userIsAllowedToCreateJobsForService = (
  service: DendroService,
  userId: string,
) => {
  if (service.userId === userId) return true;
  const u = service.users.find((u) => u.userId === userId);
  if (!u) return false;
  return u.createJobs;
};

const userIsAllowedToDeleteJobsForService = (
  service: DendroService,
  userId: string,
) => {
  if (service.userId === userId) return true;
  const u = service.users.find((u) => u.userId === userId);
  if (!u) return false;
  return u.createJobs;
};

const userIsAdminForService = (service: DendroService, userId: string) => {
  if (service.userId === userId) return true;
  const u = service.users.find((u) => u.userId === userId);
  if (!u) return false;
  return u.admin;
};

const validateJobDefinitionForServiceApp = (
  jobDefinition: DendroJobDefinition,
  app: DendroServiceApp,
) => {
  if (jobDefinition.appName !== app.appName) {
    throw Error("Mismatch between jobDefinition.appName and app.appName");
  }
  if (jobDefinition.appName !== app.appSpecification.name) {
    throw Error(
      "Mismatch between jobDefinition.appName and app.appSpecification.name",
    );
  }
  const processor = app.appSpecification.processors.find(
    (p) => p.name === jobDefinition.processorName,
  );
  if (!processor) {
    throw Error(`Processor not found in app: ${jobDefinition.processorName}`);
  }
  for (const input of processor.inputs) {
    const jobInput = jobDefinition.inputFiles.find(
      (i) => i.name === input.name,
    );
    if (!jobInput) {
      // todo: check if input is required
      throw Error(`Required input not found in job definition: ${input.name}`);
    }
  }
  for (const input of jobDefinition.inputFiles) {
    const specInput = processor.inputs.find((i) => i.name === input.name);
    if (!specInput) {
      throw Error(`Input not found in app specification: ${input.name}`);
    }
  }
  for (const output of processor.outputs) {
    const jobOutput = jobDefinition.outputFiles.find(
      (i) => i.name === output.name,
    );
    if (!jobOutput) {
      // todo: check if output is required
      throw Error(
        `Required output not found in job definition: ${output.name}`,
      );
    }
  }
  for (const output of jobDefinition.outputFiles) {
    const specOutput = processor.outputs.find((i) => i.name === output.name);
    if (!specOutput) {
      throw Error(`Output not found in app specification: ${output.name}`);
    }
  }
  for (const param of processor.parameters) {
    const jobParam = jobDefinition.parameters.find(
      (i) => i.name === param.name,
    );
    if (!jobParam) {
      if (param.defaultValue === undefined) {
        throw Error(
          `Required parameter not found in job definition: ${param.name}`,
        );
      }
    } else {
      // todo: check the type
      // jobParam.value should be compatible with param.type
    }
  }
  for (const param of jobDefinition.parameters) {
    const specParam = processor.parameters.find((i) => i.name === param.name);
    if (!specParam) {
      throw Error(`Parameter not found in app specification: ${param.name}`);
    }
  }
};

// computeUserStats handler
export const computeUserStatsHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isComputeUserStatsRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const userId = rr.userId;
      const computeStatsForJobs = (jobs: DendroJob[]) => {
        let numJobs = 0;
        let cpuHours = 0;
        let gpuHours = 0;
        let gbHours = 0;
        let jobHours = 0;
        for (const job of jobs) {
          if (
            job.timestampStartedSec !== null &&
            job.timestampFinishedSec !== null
          ) {
            const rr = job.requiredResources;
            numJobs++;
            const timeSec = job.timestampFinishedSec - job.timestampStartedSec;
            const cpuTimeSec = rr.numCpus * timeSec;
            const gpuTimeSec = rr.numGpus * timeSec;
            const gbTimeSec = rr.memoryGb * timeSec;
            const jobTimeSec = timeSec;
            cpuHours += cpuTimeSec / 3600;
            gpuHours += gpuTimeSec / 3600;
            gbHours += gbTimeSec / 3600;
            jobHours += jobTimeSec / 3600;
          }
        }
        return {
          numJobs,
          cpuHours,
          gpuHours,
          gbHours,
          jobHours,
        };
      };
      const consumedJobs = await fetchJobs(
        [{ $match: { userId, status: { $in: ["completed", "failed"] } } }],
        { includeSecrets: false, includePrivateKey: false },
      );
      const consumedStats = computeStatsForJobs(consumedJobs);
      const providedJobs = await fetchJobs(
        [
          {
            $match: {
              computeClientUserId: userId,
              status: { $in: ["completed", "failed"] },
            },
          },
        ],
        { includeSecrets: false, includePrivateKey: false },
      );
      const providedStats = computeStatsForJobs(providedJobs);
      const consumedDeletedJobs = await fetchDeletedJobs([
        { $match: { userId, status: { $in: ["completed", "failed"] } } },
      ]);
      const consumedDeletedStats = computeStatsForJobs(consumedDeletedJobs);
      const providedDeletedJobs = await fetchDeletedJobs([
        {
          $match: {
            computeClientUserId: userId,
            status: { $in: ["completed", "failed"] },
          },
        },
      ]);
      const providedDeletedStats = computeStatsForJobs(providedDeletedJobs);
      const userStats: UserStats = {
        userId,
        consumed: consumedStats,
        provided: providedStats,
        consumedDeleted: consumedDeletedStats,
        providedDeleted: providedDeletedStats,
      };
      const resp: ComputeUserStatsResponse = {
        type: "computeUserStatsResponse",
        userStats,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// getDandiApiKey handler
export const getDandiApiKeyHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetDandiApiKeyRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      const jobId = rr.jobId;
      const outputName = rr.outputName;
      const job = await fetchJob(jobId, {
        includeSecrets: true,
        includePrivateKey: true,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      if (job.status !== "running") {
        res.status(400).json({ error: "Job is not running" });
        return;
      }
      const oo = job.jobDefinition.outputFiles.find(
        (o) => o.name === outputName,
      );
      if (!oo) {
        res
          .status(400)
          .json({ error: "Output name not found in job definition" });
        return;
      }
      if (!oo.urlDeterminedAtRuntime) {
        res.status(400).json({
          error:
            "Cannot get DANDI API key because output url is not determined at run time",
        });
        return;
      }
      const computeClientId = job.computeClientId;
      if (!computeClientId) {
        res
          .status(400)
          .json({ error: "Job does not have a compute client id" });
        return;
      }
      const computeClient = await fetchComputeClient(computeClientId);
      if (!computeClient) {
        res.status(404).json({ error: "Compute client not found" });
        return;
      }
      if (computeClient.userId !== "github|magland") {
        // in the future, the dandi api key will stay secret on the server, but
        // for now we restrict to compute clients owned by magland so we don't
        // have a situation of people hacking and stealing the dandi api key
        res.status(403).json({
          error:
            "For now, only compute clients owned by magland are allowed to get Dandi API keys.",
        });
        return;
      }
      const s = job.secrets?.find((s) => s.name === "DANDI_API_KEY");
      const DANDI_API_KEY = s ? s.value : undefined;
      if (!DANDI_API_KEY) {
        res
          .status(404)
          .json({ error: "DANDI_API_KEY not found in job secrets" });
        return;
      }
      const resp: GetDandiApiKeyResponse = {
        type: "getDandiApiKeyResponse",
        dandiApiKey: DANDI_API_KEY,
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

// setOutputFileUrl handler
export const setOutputFileUrlHandler = allowCors(
  async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!issetOutputFileUrlRequest(rr)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
      if (!jobPrivateKey) {
        res.status(400).json({ error: "Job private key must be provided" });
        return;
      }
      const jobId = rr.jobId;
      const outputName = rr.outputName;
      const url = rr.url;
      const job = await fetchJob(jobId, {
        includeSecrets: false,
        includePrivateKey: true,
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      if (job.jobPrivateKey !== jobPrivateKey) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      if (job.status !== "running") {
        res.status(400).json({ error: "Job is not running" });
        return;
      }
      const oo = job.jobDefinition.outputFiles.find(
        (o) => o.name === outputName,
      );
      if (!oo) {
        res
          .status(400)
          .json({ error: "Output name not found in job definition" });
        return;
      }
      if (!oo.urlDeterminedAtRuntime) {
        res
          .status(400)
          .json({ error: "Output url is not determined at run time" });
        return;
      }
      const outputFileResultFound = job.outputFileResults.find(
        (o) => o.name === outputName,
      );
      if (!outputFileResultFound) {
        res.status(400).json({ error: "Output file result not found" });
        return;
      }
      if (outputFileResultFound.url) {
        res.status(400).json({ error: "Output file url is already set" });
        return;
      }
      const newOutputFileResults = job.outputFileResults.map((o) => {
        if (o.name === outputName) {
          return {
            ...o,
            url,
          };
        }
        return o;
      });
      const newOutputFileUrls = newOutputFileResults.map((o) => o.url);
      await updateJob(jobId, {
        outputFileResults: newOutputFileResults,
        outputFileUrlList: newOutputFileUrls,
      });
      const resp: setOutputFileUrlResponse = {
        type: "setOutputFileUrlResponse",
      };
      res.status(200).json(resp);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  },
);

const generateJobId = () => {
  return generateRandomId(20);
};

const generateJobPrivateKey = () => {
  return generateRandomId(32);
};

const createOutputFileUrl = async (a: {
  serviceName: string;
  appName: string;
  processorName: string;
  jobId: string;
  outputName: string;
  outputFileBaseName: string;
}) => {
  const {
    serviceName,
    appName,
    processorName,
    jobId,
    outputName,
    outputFileBaseName,
  } = a;
  return `https://tempory.net/f/dendro/f/${serviceName}/${appName}/${processorName}/${jobId}/${outputName}/${outputFileBaseName}`;
};

const createOtherFileUrl = async (a: {
  serviceName: string;
  appName: string;
  processorName: string;
  jobId: string;
  otherName: string;
}) => {
  const { serviceName, appName, processorName, jobId, otherName } = a;
  return `https://tempory.net/f/dendro/f/${serviceName}/${appName}/${processorName}/${jobId}/other/${otherName}`;
};

// Thanks: https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify
export const JSONStringifyDeterministic = (
  obj: any,
  space: string | number | undefined = undefined,
) => {
  const allKeys: string[] = [];
  JSON.stringify(obj, function (key, value) {
    allKeys.push(key);
    return value;
  });
  allKeys.sort();
  return JSON.stringify(obj, allKeys, space);
};

// const shuffleArray = (arr: any[]) => {
//   const randomValues = arr.map(Math.random);
//   const indices = randomValues.map((v, i) => [v, i]);
//   indices.sort((a, b) => a[0] - b[0]);
//   return indices.map((v) => arr[v[1]]);
// };

const computeSha1 = (s: string) => {
  const hash = crypto.createHash("sha1");
  hash.update(s);
  return hash.digest("hex");
};

const normalizeJobDefinitionForHash = (jobDefinition: DendroJobDefinition) => {
  return {
    ...jobDefinition,
    inputFiles: orderByName(jobDefinition.inputFiles),
    outputFiles: orderByName(jobDefinition.outputFiles),
    parameters: orderByName(jobDefinition.parameters),
  };
};

const orderByName = (arr: any[]) => {
  return arr.sort((a, b) => a.name.localeCompare(b.name));
};

const isValidOtherName = (name: string) => {
  const parts = name.split("/");
  if (parts.length === 0) return false;
  if (parts.length > 6) return false;
  for (const part of parts) {
    if (part.length === 0) return false;
    if (part.length > 64) return false;
    // Regex to allow alphanumeric, underscore, dash, and dot (but not start or end with dot)
    const regex = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/;
    if (!regex.test(part)) return false;
  }
  return true;
};
