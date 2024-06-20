/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from "@vercel/node";
import allowCors from "./allowCors.js"; // remove .js for local dev
import { getMongoClient } from "./getMongoClient.js"; // remove .js for local dev
import { AddServiceAppResponse, AddServiceResponse, AddUserResponse, CancelJobResponse, CreateJobResponse, CreateComputeClientResponse, DeleteServiceAppResponse, DeleteComputeClientResponse, DeleteServiceResponse, GetJobResponse, GetJobsResponse, GetServiceAppResponse, GetServiceAppsResponse, GetComputeClientResponse, GetComputeClientsResponse, GetServiceResponse, GetServicesResponse, GetSignedUploadUrlResponse, PairioJob, PairioJobDefinition, PairioService, PairioServiceApp, PairioComputeClient, PairioUser, ResetUserApiKeyResponse, SetServiceAppInfoResponse, SetServiceInfoResponse, SetUserInfoResponse, isAddServiceAppRequest, isAddServiceRequest, isAddUserRequest, isCancelJobRequest, isCreateJobRequest, isCreateComputeClientRequest, isDeleteServiceAppRequest, isDeleteComputeClientRequest, isDeleteServiceRequest, isGetJobRequest, isGetJobsRequest, isGetServiceAppRequest, isGetServiceAppsRequest, isGetComputeClientRequest, isGetComputeClientsRequest, isGetServiceRequest, isGetServicesRequest, isGetSignedUploadUrlRequest, isPairioJob, isPairioService, isPairioServiceApp, isPairioComputeClient, isPairioUser, isResetUserApiKeyRequest, isSetJobStatusRequest, isSetServiceAppInfoRequest, isSetServiceInfoRequest, isSetUserInfoRequest, isSetComputeClientInfoRequest, SetComputeClientInfoResponse, isGetRunnableJobsForComputeClientRequest, GetRunnableJobsForComputeClientResponse, ComputeClientComputeSlot, isGetPubsubSubscriptionRequest, isGetPubsubSubscriptionResponse, GetPubsubSubscriptionResponse, SetJobStatusRequest, SetJobStatusResponse } from "./types.js"; // remove .js for local dev
import publishPubsubMessage from "./publicPubsubMessage.js";

const TEMPORY_ACCESS_TOKEN = process.env.TEMPORY_ACCESS_TOKEN;
if (!TEMPORY_ACCESS_TOKEN) {
    throw new Error("TEMPORY_ACCESS_TOKEN is not set");
}

const dbName = 'pairio';

const collectionNames = {
    users: 'users',
    services: 'services',
    serviceApps: 'serviceApps',
    computeClients: 'computeClients',
    jobs: 'jobs'
};

// addService handler
export const addServiceHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        if (!(await authenticateUserUsingGitHubToken(userId, gitHubAccessToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const service = await fetchService(serviceName);
        if (service) {
            res.status(500).json({ error: "Service with this name already exists." })
            return;
        }
        const newService: PairioService = {
            serviceName,
            userId,
            users: []
        };
        await insertService(newService);
        const resp: AddServiceResponse = {
            type: 'addServiceResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
})

// getService handler
export const getServiceHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            res.status(404).json({ error: "Service not found" });
            return;
        }
        const resp: GetServiceResponse = {
            type: 'getServiceResponse',
            service
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
})

// getServices handler
export const getServicesHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        if (!userId) {
            res.status(400).json({ error: "userId must be provided" });
            return;
        }
        const services = await fetchServicesForUser(userId);
        const resp: GetServicesResponse = {
            type: 'getServicesResponse',
            services
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
})

// deleteService handler
export const deleteServiceHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isDeleteServiceRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    try {
        const service = await fetchService(rr.serviceName);
        if (!service) {
            res.status(404).json({ error: "Service not found" });
            return;
        }
        const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (!(await authenticateUserUsingGitHubToken(service.userId, gitHubAccessToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        await deleteService(rr.serviceName);
        const resp: DeleteServiceResponse = {
            type: 'deleteServiceResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
})

// setServiceInfo handler
export const setServiceInfoHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isSetServiceInfoRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    try {
        const service = await fetchService(rr.serviceName);
        if (!service) {
            res.status(404).json({ error: "Service not found" });
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
            res.status(401).json({ error: "User is not authorized to modify this service." })
        }
        const update: { [key: string]: any } = {};
        if (rr.users !== undefined) update['users'] = rr.users;
        await updateService(rr.serviceName, update);
        const resp: SetServiceInfoResponse = {
            type: 'setServiceInfoResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
})

// addServiceApp handler
export const addServiceAppHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        res.status(404).json({ error: "Service not found" });
        return;
    }
    const app = rr.serviceApp;
    const gitHubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (!(await authenticateUserUsingGitHubToken(service.userId, gitHubAccessToken))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        await insertServiceApp(app);
        const resp: AddServiceAppResponse = {
            type: 'addServiceAppResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// addUser handler
export const addUserHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
    if (!(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const user = await fetchUser(rr.userId);
    if (user !== null) {
        res.status(400).json({ error: "User already exists" });
        return;
    }
    try {
        const user: PairioUser = {
            userId: rr.userId,
            name: '',
            email: '',
            apiKey: null
        }
        await insertUser(user);
        const resp: AddUserResponse = {
            type: 'addUserResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// resetUserApiKey handler
export const resetUserApiKeyHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
    if (!(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const user = await fetchUser(rr.userId);
    if (user === null) {
        res.status(400).json({ error: "User does not exist" });
        return;
    }
    try {
        const apiKey = generateUserApiKey();
        user.apiKey = apiKey;
        await updateUser(rr.userId, { apiKey });
        const resp: ResetUserApiKeyResponse = {
            type: 'resetUserApiKeyResponse',
            apiKey
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// setUserInfo handler
export const setUserInfoHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
    if (!(await authenticateUserUsingGitHubToken(rr.userId, githubAccessToken))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const update: { [key: string]: any } = {};
        if (rr.name !== undefined) update['name'] = rr.name;
        if (rr.email !== undefined) update['email'] = rr.email;
        await updateUser(rr.userId, update);
        const resp: SetUserInfoResponse = {
            type: 'setUserInfoResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// createJob handler
export const createJobHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        if (!(await authenticateUserUsingApiToken(rr.userId, authorizationToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const service = await fetchService(rr.serviceName);
        if (!service) {
            res.status(404).json({ error: "Service not found" });
            return;
        }
        if (!userIsAllowedToCreateJobsForService(service, rr.userId)) {
            res.status(401).json({ error: "This user is not allowed to create jobs for this service" });
            return;
        }
        const app = await fetchServiceApp(rr.serviceName, rr.jobDefinition.appName)
        if (!app) {
            res.status(404).json({ error: "Service app not found" });
            return;
        }
        try {
            validateJobDefinitionForServiceApp(rr.jobDefinition, app)
        }
        catch(err) {
            res.status(400).json({ error: `Job definition is not compatible with app: ${err.message}` });
            return;
        }

        const jobId = generateJobId();
        const jobPrivateKey = generateJobPrivateKey();

        for (const outputFile of rr.jobDefinition.outputFiles) {
            if (outputFile.url) {
                throw Error('Output file url should not be set');
            }
            outputFile.url = await createOutputFileUrl({ serviceName: rr.serviceName, appName: rr.jobDefinition.appName, processorName: rr.jobDefinition.processorName, jobId, outputName: outputFile.name, outputFileBaseName: outputFile.fileBaseName });
        }
        const consoleOutputUrl = await createOutputFileUrl({ serviceName: rr.serviceName, appName: rr.jobDefinition.appName, processorName: rr.jobDefinition.processorName, jobId, outputName: 'console_output', outputFileBaseName: 'output.txt' });
        const resourceUtilizationLogUrl = await createOutputFileUrl({ serviceName: rr.serviceName, appName: rr.jobDefinition.appName, processorName: rr.jobDefinition.processorName, jobId, outputName: 'resource_utilization_log', outputFileBaseName: 'log.jsonl' });

        const job: PairioJob = {
            jobId,
            jobPrivateKey,
            serviceName: rr.serviceName,
            userId: rr.userId,
            batchId: rr.batchId,
            projectName: rr.projectName,
            jobDefinition: rr.jobDefinition,
            jobDefinitionHash: JSONStringifyDeterministic(rr.jobDefinition),
            requiredResources: rr.requiredResources,
            secrets: rr.secrets,
            inputFileUrls: rr.jobDefinition.inputFiles.map(f => f.url),
            outputFileUrls: rr.jobDefinition.outputFiles.map(f => f.url),
            consoleOutputUrl,
            resourceUtilizationLogUrl,
            timestampCreatedSec: Date.now() / 1000,
            timestampStartingSec: null,
            timestampStartedSec: null,
            timestampFinishedSec: null,
            canceled: false,
            status: 'pending',
            error: null,
            computeClientId: null,
            computeClientName: null,
            computeSlot: null,
            imageUri: null
        }
        await insertJob(job);

        await publishPubsubMessage(
            job.serviceName,
            {
                type: 'newPendingJob',
                serviceName: job.serviceName,
                jobId: job.jobId
            }
        )
        const resp: CreateJobResponse = {
            type: 'createJobResponse',
            jobId
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getJobs handler
export const getJobsHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const rr = req.body;
    if (!isGetJobsRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    try {
        let okayToProceed = false;
        if (rr.userId) {
            okayToProceed = true;
        }
        else if (rr.computeClientId) {
            okayToProceed = true;
        }
        else if (rr.jobId) {
            okayToProceed = true;
        }
        else if (rr.processorName) {
            okayToProceed = true;
        }
        else if ((rr.serviceName) && (rr.appName)) {
            okayToProceed = true;
        }
        else if (rr.projectName) {
            okayToProceed = true;
        }
        else if (rr.inputFileUrl) {
            okayToProceed = true;
        }
        else if (rr.outputFileUrl) {
            okayToProceed = true;
        }
        else if (rr.batchId) {
            okayToProceed = true;
        }
        if (!okayToProceed) {
            res.status(400).json({ error: "Not enough info provided in request for query for jobs" });
            return;
        }
        const query: { [key: string]: any } = {};
        if (rr.userId) query['userId'] = rr.userId;
        if (rr.jobId) query['jobId'] = rr.jobId;
        if (rr.processorName) query['processorName'] = rr.processorName;
        if (rr.computeClientId) query['computeClientId'] = rr.computeClientId;
        if (rr.batchId) query['batchId'] = rr.batchId;
        if (rr.projectName) query['projectName'] = rr.projectName;
        if (rr.serviceName) query['serviceName'] = rr.serviceName;
        if (rr.appName) query['appName'] = rr.appName;
        if (rr.inputFileUrl) query['inputFileUrls'] = rr.inputFileUrl;
        if (rr.outputFileUrl) query['outputFileUrls'] = rr.outputFileUrl;
        if (rr.status) query['status'] = rr.status;
        const jobs = await fetchJobs(query);
        // hide the private keys and secrets for the jobs
        for (const job of jobs) {
            job.jobPrivateKey = null;
            job.secrets = null;
        }
        const resp: GetJobsResponse = {
            type: 'getJobsResponse',
            jobs
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getRunnableJobsForComputeClient handler
export const getRunnableJobsForComputeClientHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetRunnableJobsForComputeClientRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    try {
        const computeClient = await fetchComputeClient(rr.computeClientId);
        if (!computeClient) {
            res.status(404).json({ error: "Compute client not found" });
            return;
        }
        const computeClientPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (computeClient.computeClientPrivateKey !== computeClientPrivateKey) {
            res.status(401).json({ error: "Unauthorized: incorrect or missing compute client private key" });
            return;
        }
        const service = await fetchService(computeClient.serviceName);
        if (!service) {
            res.status(404).json({ error: "Service not found" });
            return;
        }
        if (!userIsAllowedToProcessJobsForService(service, computeClient.userId)) {
            res.status(401).json({ error: "This compute client is not allowed to process jobs for this service" });
            return;
        }
        let pendingJobs = await fetchJobs({ serviceName: service.serviceName, status: 'pending' });
        // scramble the pending jobs so that we don't always get the same ones
        // and minimize conflicts between compute clients when there are many
        // pending jobs
        pendingJobs = shuffleArray(pendingJobs);
        const runningJobs = await fetchJobs({ serviceName: service.serviceName, status: 'running' });
        const runnableJobs: PairioJob[] = [];
        for (const pj of pendingJobs) {
            if (computeResourceHasEnoughCapacityForJob(computeClient, pj, [...runningJobs, ...runnableJobs])) {
                runnableJobs.push(pj);
            }
        }
        // remove secrets, but don't remove job private keys
        for (const job of runnableJobs) {
            job.secrets = null;
        }
        for (const job of runningJobs) {
            job.secrets = null;
        }
        const resp: GetRunnableJobsForComputeClientResponse = {
            type: 'getRunnableJobsForComputeClientResponse',
            runnableJobs,
            runningJobs
        }
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

const computeResourceHasEnoughCapacityForJob = (computeClient: PairioComputeClient, job: PairioJob, otherJobs: PairioJob[]) => {
    const slotties = computeClient.computeSlots.map(s => ({
        computeSlot: s,
        count: 0
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
}

const fitsSlot = (job: PairioJob, computeSlot: ComputeClientComputeSlot) => {
    const rr = job.requiredResources;
    const cs = computeSlot;
    if (rr.numCpus > cs.numCpus) return false;
    if (rr.numCpus > cs.numGpus) return false;
    if (rr.memoryGb > cs.memoryGb) return false;
    if (rr.timeSec > cs.timeSec) return false;
    if (rr.numCpus < cs.minNumCpus) return false;
    if (rr.numGpus < cs.minNumGpus) return false;
    if (rr.memoryGb < cs.minMemoryGb) return false;
    if (rr.timeSec < cs.minTimeSec) return false;
    return true;
}

// getJob handler
export const getJobHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        const jobs = await fetchJobs({ jobId: rr.jobId });
        if (jobs.length === 0) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        const job = jobs[0];
        if (rr.includePrivateKey) {
            if (!rr.computeClientId) {
                res.status(400).json({ error: "computeClientId must be provided if includePrivateKey is true" });
                return;
            }
            if (job.computeClientId !== rr.computeClientId) {
                res.status(401).json({ error: "Mismatch between computeClientId in request and job" });
                return;
            }
            const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
            if (!(await authenticateComputeClient(rr.computeClientId, authorizationToken))) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
        }
        else {
            job.jobPrivateKey = null;
        }
        // always hide the secrets
        job.secrets = null;
        const resp: GetJobResponse = {
            type: 'getJobResponse',
            job
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// cancelJob handler
export const cancelJobHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        const jobs = await fetchJobs({ jobId: rr.jobId });
        if (jobs.length === 0) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        const job = jobs[0];
        const authorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (!(await authenticateUserUsingApiToken(job.userId, authorizationToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (job.status === 'completed' || job.status === 'failed') {
            res.status(400).json({ error: "Job is already completed or failed" });
            return;
        }
        await updateJob(rr.jobId, { canceled: true });
        const resp: CancelJobResponse = {
            type: 'cancelJobResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// setJobStatus handler
export const setJobStatusHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        const job = await fetchJob(rr.jobId);
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        if (job.jobPrivateKey !== jobPrivateKey) {
            res.status(401).json({ error: "Unauthorized: incorrect or missing job private key" });
            return;
        }
        const computeClientId = rr.computeClientId;
        const computeClient = await fetchComputeClient(computeClientId);
        if (!computeClient) {
            res.status(404).json({ error: "Compute client not found" });
            return;
        }
        const computeClientUserId = computeClient.userId;
        if (job.computeClientId) {
            if (job.computeClientId !== computeClientId) {
                res.status(401).json({ error: "Mismatch between computeClientId in request and job" });
                return;
            }
        }
        else {
            if (job.status !== 'pending') {
                res.status(400).json({ error: "Job is not in pending status and the compute client is not set" });
                return;
            }
            if (rr.status !== 'starting') {
                res.status(400).json({ error: "Trying to set job to a status other than starting when compute client is not set" });
                return;
            }
        }
        if (rr.status === 'starting') {
            if (job.status !== 'pending') {
                res.status(400).json({ error: "Job is not in pending status" });
                return;
            }
            const service = await fetchService(job.serviceName);
            if (!service) {
                res.status(404).json({ error: "Service not found" });
                return;
            }
            if (!userIsAllowedToProcessJobsForService(service, computeClientUserId)) {
                res.status(401).json({ error: "This compute client is not allowed to process jobs for this service" });
                return;
            }
            await atomicUpdateJob(rr.jobId, 'pending', { status: 'starting', computeClientId, computeClientName: computeClient.computeClientName, timestampStartingSec: Date.now() / 1000 });
        }
        else if (rr.status === 'running') {
            if (job.status !== 'starting') {
                res.status(400).json({ error: "Job is not in pending status" });
                return;
            }
            await atomicUpdateJob(rr.jobId, 'starting', { status: 'running', timestampStartedSec: Date.now() / 1000 });
        }
        else if (rr.status === 'completed' || rr.status === 'failed') {
            if (job.status !== 'running') {
                res.status(400).json({ error: "Job is not in running status" });
                return;
            }
            if (rr.status === 'completed') {
                if (rr.error) {
                    res.status(400).json({ error: "Error should not be set for completed job" });
                    return;
                }
            }
            else if (rr.status === 'failed') {
                if (!rr.error) {
                    res.status(400).json({ error: "Error must be set for failed job" });
                    return;
                }
            }
            await updateJob(rr.jobId, { status: rr.status, error: rr.error, timestampFinishedSec: Date.now() / 1000 })
        }
        else {
            res.status(400).json({ error: "Invalid status" });
            return;
        }
        await publishPubsubMessage(
            job.serviceName,
            {
                type: 'jobStatusChanged',
                serviceName: job.serviceName,
                jobId: job.jobId,
                status: rr.status
            }
        )
        const resp: SetJobStatusResponse = {
            type: 'setJobStatusResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getSignedUploadUrl handler
export const getSignedUploadUrlHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        const jobs = await fetchJobs({ jobId: rr.jobId });
        if (jobs.length === 0) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        const job = jobs[0];
        const computeClientId = job.computeClientId;
        if (!computeClientId) {
            res.status(400).json({ error: "Job does not have a compute client" });
            return;
        }
        const jobPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (job.jobPrivateKey !== jobPrivateKey) {
            res.status(401).json({ error: "Unauthorized: incorrect or missing job private key" });
            return;
        }
        let url: string
        if (rr.uploadType === 'output') {
            if (!rr.outputName) {
                res.status(400).json({ error: "Must specify outputName" });
                return;
            }
            const oo = job.jobDefinition.outputFiles.find(o => (o.name === rr.outputName))
            if (!oo) {
                res.status(400).json({ error: "Output file not found" });
                return;
            }
            url = oo.url;
        }
        else if (rr.uploadType === 'consoleOutput') {
            url = job.consoleOutputUrl
        }
        else if (rr.uploadType === 'resourceUtilizationLog') {
            url = job.resourceUtilizationLogUrl
        }
        else if (rr.uploadType === 'other') {
            // not implemented
            res.status(400).json({ error: "Not implemented: uploadType=other" });
            return;
        }
        else {
            res.status(400).json({ error: "Invalid uploadType" });
            return
        }
        const signedUrl = await createSignedUploadUrl({ url, size: rr.size, userId: job.userId });
        const resp: GetSignedUploadUrlResponse = {
            type: 'getSignedUploadUrlResponse',
            signedUrl
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// deleteComputeClient handler
export const deleteComputeClientHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        if (!(await authenticateUserUsingGitHubToken(computeClient.userId, gitHubAccessToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        await deleteComputeClient(rr.computeClientId);
        const resp: DeleteComputeClientResponse = {
            type: 'deleteComputeClientResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// createComputeClient handler
export const createComputeClientHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
    if (!(await authenticateUserUsingGitHubToken(rr.userId, gitHubAccessToken))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const computeClient: PairioComputeClient = {
        userId: rr.userId,
        serviceName: rr.serviceName,
        computeClientId: generateComputeClientId(),
        computeClientPrivateKey: generateComputeClientPrivateKey(),
        computeClientName: rr.computeClientName,
        description: '',
        computeSlots: []
    };
    try {
        await insertComputeClient(computeClient);
        const resp: CreateComputeClientResponse = {
            type: 'createComputeClientResponse',
            computeClientId: computeClient.computeClientId,
            computeClientPrivateKey: computeClient.computeClientPrivateKey || '' // should not be null
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getComputeClient handler
export const getComputeClientHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            type: 'getComputeClientResponse',
            computeClient
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getComputeClients handler
export const getComputeClientsHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            const computeClients = await fetchComputeClientsForService(rr.serviceName);
            // hide the private keys
            for (const computeClient of computeClients) {
                computeClient.computeClientPrivateKey = null;
            }
            const resp: GetComputeClientsResponse = {
                type: 'getComputeClientsResponse',
                computeClients
            };
            res.status(200).json(resp);
        }
        else {
            res.status(400).json({ error: "Must specify serviceName in request" });
            return;
        }
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// setComputeClientInfo handler
export const setComputeClientInfoHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
        if (!(await authenticateUserUsingGitHubToken(computeClient.userId, gitHubAccessToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const update: { [key: string]: any } = {};
        if (rr.computeClientName !== undefined) update['computeClientName'] = rr.computeClientName;
        if (rr.description !== undefined) update['description'] = rr.description;
        if (rr.computeSlots !== undefined) update['computeSlots'] = rr.computeSlots;
        await updateComputeClient(rr.computeClientId, update);
        const resp: SetComputeClientInfoResponse = {
            type: 'setComputeClientInfoResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// setServiceAppInfo handler
export const setServiceAppInfoHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            res.status(404).json({ error: "Service not found" });
            return;
        }
        const githubAccessToken = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (!(await authenticateUserUsingGitHubToken(service.userId, githubAccessToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const update: { [key: string]: any } = {};
        if (rr.description !== undefined) update['description'] = rr.description;
        if (rr.appSpecificationUri !== undefined) update['appSpecificationUri'] = rr.appSpecificationUri;
        if (rr.appSpecificationCommit !== undefined) update['appSpecificationCommit'] = rr.appSpecificationCommit;
        if (rr.processors !== undefined) update['processors'] = rr.processors;
        await updateServiceApp(rr.serviceName, rr.appName, update);
        const resp: SetServiceAppInfoResponse = {
            type: 'setServiceAppInfoResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getServiceApp handler
export const getServiceAppHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            type: 'getServiceAppResponse',
            app
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// deleteServiceApp handler
export const deleteServiceAppHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
            res.status(404).json({ error: "Service not found" });
            return;
        }
        const gitHubAuthorizationToken = req.headers.authorization?.split(" ")[1]; // Extract the token
        if (!(await authenticateUserUsingGitHubToken(service.userId, gitHubAuthorizationToken))) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const app = await fetchServiceApp(rr.serviceName, rr.appName);
        if (!app) {
            res.status(404).json({ error: "Service app not found" });
            return;
        }
        await deleteServiceApp(rr.serviceName, rr.appName);
        const resp: DeleteServiceAppResponse = {
            type: 'deleteServiceAppResponse'
        };
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getServiceApps handler
export const getServiceAppsHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
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
                res.status(400).json({ error: "Cannot specify both appName and serviceName in request" });
                return;
            }
            const apps = await fetchServiceAppsForAppName(rr.appName);
            const resp: GetServiceAppsResponse = {
                type: 'getServiceAppsResponse',
                serviceApps: apps
            };
            res.status(200).json(resp);
        }
        else if (rr.serviceName) {
            const apps = await fetchServiceAppsForServiceName(rr.serviceName);
            const resp: GetServiceAppsResponse = {
                type: 'getServiceAppsResponse',
                serviceApps: apps
            };
            res.status(200).json(resp);
        }
        else {
            res.status(400).json({ error: "Must specify either appName or serviceName in request" });
            return;

        }
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// getPubsubSubscription handler
export const getPubsubSubscriptionHandler = allowCors(async (req: VercelRequest, res: VercelResponse) => {
    const rr = req.body;
    if (!isGetPubsubSubscriptionRequest(rr)) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    try {
        const computeClientId = rr.computeClientId;
        if (!computeClientId) {
            res.status(400).json({ error: "Must specify computeClientId in request" });
            return;
        }
        const computeClientPrivateKey = req.headers.authorization?.split(" ")[1]; // Extract the token
        const computeClient = await fetchComputeClient(computeClientId);
        if (!computeClient) {
            res.status(404).json({ error: "Compute client not found" });
            return;
        }
        if (computeClient.computeClientPrivateKey !== computeClientPrivateKey) {
            res.status(401).json({ error: "Unauthorized: incorrect or missing compute client private key" });
            return;
        }
        const VITE_PUBNUB_SUBSCRIBE_KEY = process.env.VITE_PUBNUB_SUBSCRIBE_KEY;
        if (!VITE_PUBNUB_SUBSCRIBE_KEY) {
            res.status(500).json({ error: "VITE_PUBNUB_SUBSCRIBE_KEY not set" });
            return;
        }
        const resp: GetPubsubSubscriptionResponse = {
            type: 'getPubsubSubscriptionResponse',
            subscription: {
                pubnubSubscribeKey: VITE_PUBNUB_SUBSCRIBE_KEY,
                pubnubChannel: computeClient.serviceName,
                pubnubUser: computeClientId
            }
        }
        res.status(200).json(resp);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

////////////////////////////////////////

const authenticateUserUsingApiToken = async (userId: string, authorizationToken: string | undefined): Promise<boolean> => {
    const user = await fetchUser(userId)
    if (!user) return false;
    if (user.apiKey !== authorizationToken) return false;
    return true;
}

const authenticateUserUsingGitHubToken = async (userId: string, gitHubAccessToken: string | undefined): Promise<boolean> => {
    if (!gitHubAccessToken) return false;
    const githubUserId = await getUserIdForGitHubAccessToken(gitHubAccessToken);
    return userId === `github|${githubUserId}`;
}

const fetchService = async (serviceName: string): Promise<PairioService | null> => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.services);
    const service = await collection.findOne({ serviceName });
    if (!service) return null;
    removeMongoId(service);
    if (!isPairioService(service)) {
        throw Error('Invalid service in database');
    }
    return service;
}

const fetchServicesForUser = async (userId: string): Promise<PairioService[]> => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.services);
    const services = await collection.find({ userId }).toArray();
    for (const service of services) {
        removeMongoId(service);
        if (!isPairioService(service)) {
            throw Error('Invalid service in database');
        }
    }
    return services.map((service: any) => service as PairioService);
}

const insertService = async (service: PairioService) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.services);
    await collection.updateOne({ serviceName: service.serviceName }, { $setOnInsert: service }, { upsert: true });
}

const deleteService = async (serviceName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.services);
    await collection.deleteOne({ serviceName });
}

const updateService = async (serviceName: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.services);
    await collection
        .updateOne({ serviceName }, { $set: update });
}

const fetchUser = async (userId: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.users);
    const user = await collection.findOne({ userId });
    if (!user) return null;
    removeMongoId(user);
    if (!isPairioUser(user)) {
        throw Error('Invalid user in database');
    }
    return user;
}

const insertUser = async (user: PairioUser) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.users);
    await collection.updateOne({ userId: user.userId }, { $setOnInsert: user }, { upsert: true });
}

const updateUser = async (userId: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.users);
    await collection
        .updateOne({ userId }, { $set: update });
}

const insertServiceApp = async (app: PairioServiceApp) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    await collection.insertOne(app);
}

const fetchServiceApp = async (serviceName: string, appName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    const app = await collection.findOne({ serviceName, appName });
    if (!app) return null;
    removeMongoId(app);
    if (!isPairioServiceApp(app)) {
        throw Error('Invalid service app in database');
    }
    return app;
}

const fetchServiceAppsForAppName = async (appName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    const apps = await collection.find({ appName }).toArray();
    for (const app of apps) {
        removeMongoId(app);
        if (!isPairioServiceApp(app)) {
            throw Error('Invalid service app in database');
        }
    }
    return apps.map((app: any) => app as PairioServiceApp);
}

const fetchServiceAppsForServiceName = async (serviceName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    const apps = await collection.find({ serviceName }).toArray();
    for (const app of apps) {
        removeMongoId(app);
        if (!isPairioServiceApp(app)) {
            throw Error('Invalid service app in database');
        }
    }
    return apps.map((app: any) => app as PairioServiceApp);
}

const updateServiceApp = async (serviceName: string, appName: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    await collection
        .updateOne({ serviceName, appName }, { $set: update });
}

const deleteServiceApp = async (serviceName: string, appName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.serviceApps);
    await collection.deleteOne({ serviceName, appName });
}

const fetchJob = async (jobId: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.jobs);
    const job = await collection.findOne({ jobId });
    if (!job) return null;
    removeMongoId(job);
    if (!isPairioJob(job)) {
        throw Error('Invalid job in database');
    }
    return job;
}

const fetchJobs = async (query: { [key: string]: any }) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.jobs);
    const jobs = await collection
        .find(query)
        .toArray();
    for (const job of jobs) {
        removeMongoId(job);
        if (!isPairioJob(job)) {
            throw Error('Invalid job in database');
        }
    }
    return jobs.map((job: any) => job as PairioJob);
}

const updateJob = async (jobId: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.jobs);
    await collection.updateOne({
        jobId
    }, {
        $set: update
    });
}

const atomicUpdateJob = async (jobId: string, oldStatus: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.jobs);
    // QUESTION: is this going to be atomic?
    // Like if two requests come in at the same time, will one of them fail?
    const result = await collection.updateOne({
        jobId,
        status: oldStatus
    }, {
        $set: update
    });
    if (result.modifiedCount !== 1) {
        throw Error('Failed to update job');
    }
}

const insertJob = async (job: PairioJob) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.jobs);
    await collection.insertOne(job);
}

const insertComputeClient = async (computeClient: PairioComputeClient) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.computeClients);
    await collection.insertOne(computeClient);
}

const fetchComputeClient = async (computeClientId: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.computeClients);
    const computeClient = await collection.findOne({ computeClientId });
    if (!computeClient) return null;
    removeMongoId(computeClient);
    if (!isPairioComputeClient(computeClient)) {
        throw Error('Invalid compute client in database');
    }
    return computeClient;
}

const fetchComputeClientsForService = async (serviceName: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.computeClients);
    const computeClients = await collection.find({ serviceName }).toArray();
    for (const computeClient of computeClients) {
        removeMongoId(computeClient);
        if (!isPairioComputeClient(computeClient)) {
            throw Error('Invalid compute client in database');
        }
    }
    return computeClients.map((computeClient: any) => computeClient as PairioComputeClient);
}

const deleteComputeClient = async (computeClientId: string) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.computeClients);
    await collection.deleteOne({ computeClientId });
}

const updateComputeClient = async (computeClientId: string, update: any) => {
    const client = await getMongoClient();
    const collection = client.db(dbName).collection(collectionNames.computeClients);
    await collection
        .updateOne({ computeClientId }, { $set: update });
}

const authenticateComputeClient = async (computeClientId: string, authorizationToken: string | undefined): Promise<boolean> => {
    const computeClient = await fetchComputeClient(computeClientId);
    if (!computeClient) return false;
    if (computeClient.computeClientPrivateKey !== authorizationToken) return false;
    return true;
}

const removeMongoId = (x: any) => {
    if (x === null) return;
    if (typeof x !== 'object') return;
    if ('_id' in x) delete x['_id'];
}

const gitHubUserIdCache: { [accessToken: string]: string } = {};
const getUserIdForGitHubAccessToken = async (gitHubAccessToken: string) => {
    if (gitHubUserIdCache[gitHubAccessToken]) {
        return gitHubUserIdCache[gitHubAccessToken];
    }

    const response = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `token ${gitHubAccessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get user id');
    }

    const data = await response.json();
    const userId = data.login;
    gitHubUserIdCache[gitHubAccessToken] = userId;
    return userId;
}

const generateUserApiKey = () => {
    return generateRandomId(32);
}

const generateRandomId = (len: number) => {
    const choices = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const numChoices = choices.length;
    let ret = '';
    for (let i = 0; i < len; i++) {
        ret += choices[Math.floor(Math.random() * numChoices)];
    }
    return ret;
}

const generateComputeClientId = () => {
    return generateRandomId(12);
}

const generateComputeClientPrivateKey = () => {
    return generateRandomId(32);
}

const createSignedUploadUrl = async (o: { url: string, size: number, userId: string }) => {
    const { url, size, userId } = o;
    const prefix = `https://tempory.net/f/pairio/`;
    if (!url.startsWith(prefix)) {
        throw Error('Invalid url. Does not have proper prefix');
    }
    const filePath = url.slice(prefix.length);
    const temporyApiUrl = 'https://hub.tempory.net/api/uploadFile'
    const response = await fetch(temporyApiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TEMPORY_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            appName: "pairio",
            filePath,
            size,
            userId
        }),
    });
    if (!response.ok) {
        throw Error('Failed to get signed url');
    }
    const result = await response.json();
    const { uploadUrl, downloadUrl } = result;
    if (downloadUrl !== url) {
        throw Error('Mismatch between download url and url');
    }
    return uploadUrl;
}

const userIsAllowedToProcessJobsForService = (service: PairioService, userId: string) => {
    if (service.userId === userId) return true;
    const u = service.users.find(u => u.userId === userId);
    if (!u) return false;
    return u.processJobs;
}

const userIsAllowedToCreateJobsForService = (service: PairioService, userId: string) => {
    if (service.userId === userId) return true;
    const u = service.users.find(u => u.userId === userId);
    if (!u) return false;
    return u.createJobs;
}

const userIsAdminForService = (service: PairioService, userId: string) => {
    if (service.userId === userId) return true;
    const u = service.users.find(u => u.userId === userId);
    if (!u) return false;
    return u.admin;
}

const validateJobDefinitionForServiceApp = (jobDefinition: PairioJobDefinition, app: PairioServiceApp) => {
    if (jobDefinition.appName !== app.appName) {
        throw Error('Mismatch between jobDefinition.appName and app.appName');
    }
    if (jobDefinition.appName !== app.appSpecification.name) {
        throw Error('Mismatch between jobDefinition.appName and app.appSpecification.name');
    }
    const processor = app.appSpecification.processors.find(p => p.name === jobDefinition.processorName);
    if (!processor) {
        throw Error(`Processor not found in app: ${jobDefinition.processorName}`);
    }
    for (const input of processor.inputs) {
        const jobInput = jobDefinition.inputFiles.find(i => i.name === input.name);
        if (!jobInput) {
            // todo: check if input is required
            throw Error(`Required input not found in job definition: ${input.name}`);
        }
    }
    for (const input of jobDefinition.inputFiles) {
        const specInput = processor.inputs.find(i => i.name === input.name);
        if (!specInput) {
            throw Error(`Input not found in app specification: ${input.name}`);
        }
    }
    for (const output of processor.outputs) {
        const jobOutput = jobDefinition.outputFiles.find(i => i.name === output.name);
        if (!jobOutput) {
            // todo: check if output is required
            throw Error(`Required output not found in job definition: ${output.name}`);
        }
    }
    for (const output of jobDefinition.outputFiles) {
        const specOutput = processor.outputs.find(i => i.name === output.name);
        if (!specOutput) {
            throw Error(`Output not found in app specification: ${output.name}`);
        }
    }
    for (const param of processor.parameters) {
        const jobParam = jobDefinition.parameters.find(i => i.name === param.name);
        if (!jobParam) {
            if (param.defaultValue === undefined) {
                throw Error(`Required parameter not found in job definition: ${param.name}`);
            }
        }
        else {
            // todo: check the type
            // jobParam.value should be compatible with param.type
        }
    }
    for (const param of jobDefinition.parameters) {
        const specParam = processor.parameters.find(i => i.name === param.name);
        if (!specParam) {
            throw Error(`Parameter not found in app specification: ${param.name}`);
        }
    }
}

const generateJobId = () => {
    return generateRandomId(20);
}

const generateJobPrivateKey = () => {
    return generateRandomId(32);
}

const createOutputFileUrl = async (a: { serviceName: string, appName: string, processorName: string, jobId: string, outputName: string, outputFileBaseName: string }) => {
    const { serviceName, appName, processorName, jobId, outputName, outputFileBaseName } = a;
    return `https://tempory.net/f/pairio/f/${serviceName}/${appName}/${processorName}/${jobId}/${outputName}/${outputFileBaseName}`;
}

// Thanks: https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify
export const JSONStringifyDeterministic = ( obj: any, space: string | number | undefined =undefined ) => {
    const allKeys: string[] = [];
    JSON.stringify( obj, function( key, value ){ allKeys.push( key ); return value; } )
    allKeys.sort();
    return JSON.stringify( obj, allKeys, space );
}

const shuffleArray = (arr: any[]) => {
    const randomValues = arr.map(Math.random);
    const indices = randomValues.map((v, i) => [v, i]);
    indices.sort((a, b) => a[0] - b[0]);
    return indices.map(v => arr[v[1]]);
}
