import { CreateJobRequest, GetJobRequest, PairioJob, PairioJobDefinition, isCreateJobResponse, isGetJobResponse } from "../../types"

const submitJob = async (o: {jobDefinition: PairioJobDefinition, pairioApiKey?: string, serviceName: string}): Promise<PairioJob> => {
    const { jobDefinition, pairioApiKey, serviceName } = o
    if (!pairioApiKey) {
        throw new Error('pairioApiKey is required')
    }

    const req: CreateJobRequest = {
        type: 'createJobRequest',
        serviceName,
        userId: '',  // determined from the api key
        batchId: '',
        tags: [],
        jobDefinition,
        requiredResources: {
            numCpus: 1,
            numGpus: 0,
            memoryGb: 4,
            timeSec: 60
        },
        secrets: [],
        jobDependencies: [],
        skipCache: false,
        rerunFailing: false,
        deleteFailing: false
    }
    console.info('jobDefinition', jobDefinition)
    const headers = {
        'Authorization': `Bearer: ${pairioApiKey}`
    }
    const url = '/api/createJob'
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(req)
    })
    if (!resp.ok) {
        throw new Error(`Error in submitJob: ${await resp.text()}`)
    }
    const json = await resp.json()
    if (!isCreateJobResponse(json)) {
        throw new Error(`Unexpected response for createJobRequest`)
    }
    const job = json.job
    return job
}

export const getJob = async (o: {jobId: string}): Promise<PairioJob> => {
    const { jobId } = o
    const req: GetJobRequest = {
        type: 'getJobRequest',
        jobId,
        includePrivateKey: false
    }
    const url = '/api/getJob'
    const headers = {
    }
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(req)
    })
    if (!resp.ok) {
        throw Error(`Error in getJobRequest: ${await resp.text()}`)
    }
    const json = await resp.json()
    if (!isGetJobResponse(json)) {
        console.warn(json)
        throw Error(`Unexpected response for getJobRequest`)
    }
    return json.job
}

export default submitJob