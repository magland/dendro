/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLogin } from "./LoginContext/LoginContext";
import { AddServiceAppRequest, AddServiceRequest, ComputeUserStatsRequest, CreateComputeClientRequest, DeleteComputeClientRequest, DeleteJobsRequest, DeleteServiceRequest, GetComputeClientRequest, GetComputeClientsRequest, GetJobRequest, GetJobsRequest, GetServiceAppRequest, GetServiceAppsRequest, GetServiceRequest, GetServicesRequest, PairioComputeClient, PairioJob, PairioService, PairioServiceApp, PairioServiceUser, PingComputeClientsRequest, SetServiceAppInfoRequest, SetServiceInfoRequest, UserStats, isAddServiceAppResponse, isAddServiceResponse, isComputeUserStatsResponse, isCreateComputeClientResponse, isDeleteJobsResponse, isGetComputeClientResponse, isGetComputeClientsResponse, isGetJobResponse, isGetJobsResponse, isGetServiceAppResponse, isGetServiceAppsResponse, isGetServiceResponse, isGetServicesResponse, isPairioAppSpecification, isSetServiceAppInfoResponse, isSetServiceInfoResponse } from "./types";

const isLocalHost = window.location.hostname === 'localhost'
const apiUrl = isLocalHost ? 'http://localhost:3000' : 'https://pairio.vercel.app'

export const useServices = () => {
    const { userId, githubAccessToken } = useLogin();
    const [services, setServices] = useState<PairioService[] | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshServices = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false;
        setServices(undefined);
        if (!userId) return;
        (async () => {
            const req: GetServicesRequest = {
                type: 'getServicesRequest',
                userId
            }
            const resp = await apiPostRequest('getServices', req, undefined)
            if (canceled) return
            if (!isGetServicesResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setServices(resp.services)
        })()
        return () => { canceled = true }
    }, [userId, refreshCode])

    const addService = useCallback(async (serviceName: string) => {
        if (!githubAccessToken) return;
        if (!userId) return;
        const req: AddServiceRequest = {
            type: 'addServiceRequest',
            userId,
            serviceName
        }
        const resp = await apiPostRequest('addService', req, githubAccessToken)
        if (!isAddServiceResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        refreshServices()
    }, [refreshServices, githubAccessToken, userId])

    return {
        services,
        refreshServices,
        addService
    }
}

export const useService = (serviceName: string) => {
    const { githubAccessToken, userId } = useLogin()
    const [service, setService] = useState<PairioService | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshService = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])

    useEffect(() => {
        let canceled = false
        setService(undefined)
        if (!githubAccessToken) return
        (async () => {
            const req: GetServiceRequest = {
                type: 'getServiceRequest',
                serviceName
            }
            const resp = await apiPostRequest('getService', req, githubAccessToken)
            if (canceled) return
            if (!isGetServiceResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setService(resp.service)
        })()
        return () => { canceled = true }
    }, [serviceName, githubAccessToken, refreshCode])

    const deleteService = useCallback(async () => {
        if (!githubAccessToken) return
        const req: DeleteServiceRequest = {
            type: 'deleteServiceRequest',
            serviceName
        }
        const resp = await apiPostRequest('deleteService', req, githubAccessToken)
        if (!isGetServiceResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        setService(undefined)
    }, [serviceName, githubAccessToken])

    const setServiceInfo = useMemo(() => (async (o: { users: PairioServiceUser[] }) => {
        const { users } = o
        if (!githubAccessToken) return
        const req: SetServiceInfoRequest = {
            type: 'setServiceInfoRequest',
            serviceName,
            users
        }
        const resp = await apiPostRequest('setServiceInfo', req, githubAccessToken)
        if (!isSetServiceInfoResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        refreshService()
    }), [serviceName, githubAccessToken, refreshService])

    const createComputeClient = useMemo(() => (async (o: { computeClientName: string }) => {
        if (!userId) return
        if (!githubAccessToken) return
        const { computeClientName } = o
        const req: CreateComputeClientRequest = {
            type: 'createComputeClientRequest',
            userId,
            computeClientName,
            serviceName
        }
        const resp = await apiPostRequest('createComputeClient', req, githubAccessToken)
        if (!isCreateComputeClientResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        const computeClientId = resp.computeClientId
        const computeClientPrivateKey = resp.computeClientPrivateKey
        return {computeClientId, computeClientPrivateKey}
    }), [])

    const addServiceAppFromSourceUri = useMemo(() => (async (o: { sourceUri: string }) => {
        if (!githubAccessToken) return
        const spec = await loadJsonFromUri(o.sourceUri)
        if (!isPairioAppSpecification(spec)) {
            console.warn(spec)
            throw Error('Invalid app specification')
        }
        const serviceApp: PairioServiceApp = {
            serviceName,
            appName: spec.name,
            appSpecificationUri: o.sourceUri,
            appSpecificationCommit: '', // todo
            appSpecification: spec
        }
        const req: AddServiceAppRequest = {
            type: 'addServiceAppRequest',
            serviceApp
        }
        const resp = await apiPostRequest('addServiceApp', req, githubAccessToken)
        if (!isAddServiceAppResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        return serviceApp
    }), [])

    return { service, deleteService, setServiceInfo, refreshService, createComputeClient, addServiceAppFromSourceUri }
}

export const useComputeClients = (serviceName: string) => {
    const [computeClients, setComputeClients] = useState<PairioComputeClient[] | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const pingFirst = useRef(false)
    const refreshComputeClients = useCallback((o?: {pingFirst: boolean}) => {
        pingFirst.current = o?.pingFirst || false
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setComputeClients(undefined);
        (async () => {
            if (pingFirst.current) {
                await pingComputeClients()
                // give the compute clients some time to respond
                await new Promise(r => setTimeout(r, 4000))
            }
            const req: GetComputeClientsRequest = {
                type: 'getComputeClientsRequest',
                serviceName
            }
            const resp = await apiPostRequest('getComputeClients', req)
            if (canceled) return
            if (!isGetComputeClientsResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setComputeClients(resp.computeClients)
        })()
        return () => { canceled = true }
    }, [refreshCode, serviceName])

    const pingComputeClients = useCallback(async () => {
        const req: PingComputeClientsRequest = {
            type: 'pingComputeClientsRequest',
            serviceName
        }
        const resp = await apiPostRequest('pingComputeClients', req)
        if (!isGetComputeClientsResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
    }, [computeClients])

    return {
        computeClients,
        refreshComputeClients
    }
}

export const useServiceApps = (serviceName: string) => {
    const [serviceApps, setServiceApps] = useState<PairioServiceApp[] | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshServiceApps = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setServiceApps(undefined)
        ;(async () => {
            const req: GetServiceAppsRequest = {
                type: 'getServiceAppsRequest',
                serviceName
            }
            const resp = await apiPostRequest('getServiceApps', req)
            if (canceled) return
            if (!isGetServiceAppsResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setServiceApps(resp.serviceApps)
        })()
        return () => { canceled = true }
    }, [serviceName, refreshCode])

    return { serviceApps, refreshServiceApps }
}

export const useComputeClient = (computeClientId: string) => {
    const { githubAccessToken } = useLogin()
    const [computeClient, setComputeClient] = useState<PairioComputeClient | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshComputeClient = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setComputeClient(undefined)
        if (!githubAccessToken) return
        (async () => {
            const req: GetComputeClientRequest = {
                type: 'getComputeClientRequest',
                computeClientId
            }
            const resp = await apiPostRequest('getComputeClient', req, githubAccessToken)
            if (canceled) return
            if (!isGetComputeClientResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setComputeClient(resp.computeClient)
        })()
        return () => { canceled = true }
    }, [computeClientId, githubAccessToken, refreshCode])

    const deleteComputeClient = useCallback(async () => {
        if (!githubAccessToken) return
        const req: DeleteComputeClientRequest = {
            type: 'deleteComputeClientRequest',
            computeClientId
        }
        const resp = await apiPostRequest('deleteComputeClient', req, githubAccessToken)
        if (!isGetComputeClientResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        setComputeClient(undefined)
    }, [computeClientId, githubAccessToken])

    return { computeClient, deleteComputeClient, refreshComputeClient }
}

export const useJobs = (o: { computeClientId?: string, serviceName: string }) => {
    const { computeClientId, serviceName } = o
    const [jobs, setJobs] = useState<PairioJob[] | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const { userId, githubAccessToken } = useLogin()
    const refreshJobs = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setJobs(undefined)
        ;(async () => {
            const req: GetJobsRequest = {
                type: 'getJobsRequest',
                computeClientId,
                serviceName,
                limit: 100
            }
            const resp = await apiPostRequest('getJobs', req)
            if (canceled) return
            if (!isGetJobsResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setJobs(resp.jobs)
        })()
        return () => { canceled = true }
    }, [computeClientId, serviceName, refreshCode])

    const deleteJobs = useMemo(() => (async (jobIds: string[]) => {
        if (!userId) return
        if (!githubAccessToken) return
        const req: DeleteJobsRequest = {
            type: 'deleteJobsRequest',
            userId,
            serviceName,
            jobIds
        }
        const resp = await apiPostRequest('deleteJobs', req, githubAccessToken)
        if (!isDeleteJobsResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        refreshJobs()
    }), [userId, githubAccessToken, serviceName, refreshJobs])

    return { jobs, refreshJobs, deleteJobs }
}

export const useServiceApp = (serviceName: string, appName: string) => {
    const [serviceApp, setServiceApp] = useState<PairioServiceApp | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const { githubAccessToken } = useLogin()
    const refreshServiceApp = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setServiceApp(undefined)
        ;(async () => {
            const req: GetServiceAppRequest = {
                type: 'getServiceAppRequest',
                serviceName,
                appName
            }
            const resp = await apiPostRequest('getServiceApp', req)
            if (!isGetServiceAppResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            if (canceled) return
            setServiceApp(resp.serviceApp)
        })()
        return () => { canceled = true }
    }, [serviceName, appName, refreshCode])

    const updateFromSource = useCallback(async () => {
        if (!serviceApp) return
        if (!serviceApp.appSpecificationUri) return
        if (!githubAccessToken) return
        const spec = await loadJsonFromUri(serviceApp.appSpecificationUri)
        if (!isPairioAppSpecification(spec)) {
            console.warn(spec)
            throw Error('Invalid app specification')
        }
        const req: SetServiceAppInfoRequest = {
            type: 'setServiceAppInfoRequest',
            serviceName,
            appName,
            appSpecification: spec
        }
        const resp = await apiPostRequest('setServiceAppInfo', req, githubAccessToken)
        if (!isSetServiceAppInfoResponse(resp)) {
            console.error('Invalid response', resp)
            return
        }
        refreshServiceApp()
        alert('Updated from source')
    }, [serviceApp, serviceName, appName, refreshServiceApp])

    return { serviceApp, refreshServiceApp, updateFromSource }
}

export const useJob = (jobId: string) => {
    const [job, setJob] = useState<PairioJob | undefined>(undefined)
    const [refreshCode, setRefreshCode] = useState(0)
    const refreshJob = useCallback(() => {
        setRefreshCode(c => c + 1)
    }, [])
    useEffect(() => {
        let canceled = false
        setJob(undefined)
        ;(async () => {
            const req: GetJobRequest = {
                type: 'getJobRequest',
                jobId,
                includePrivateKey: false
            }
            const resp = await apiPostRequest('getJob', req)
            if (!isGetJobResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            if (canceled) return
            setJob(resp.job)
        })()
        return () => { canceled = true }
    }, [jobId, refreshCode])

    return { job, refreshJob }
}

export const useUserStats = (userId: string) => {
    const [userStats, setUserStats] = useState<UserStats | undefined>(undefined)
    useEffect(() => {
        let canceled = false
        setUserStats(undefined)
        ;(async () => {
            const req: ComputeUserStatsRequest = {
                type: 'computeUserStatsRequest',
                userId
            }
            const resp = await apiPostRequest('computeUserStats', req)
            if (!resp) return
            if (canceled) return
            if (!isComputeUserStatsResponse(resp)) {
                console.error('Invalid response', resp)
                return
            }
            setUserStats(resp.userStats)
        })()
        return () => { canceled = true }
    }, [userId])
    return { userStats }
}

export const apiPostRequest = async (path: string, req: any, accessToken?: string) => {
    const url = `${apiUrl}/api/${path}`
    const headers: { [key: string]: string } = {}
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
    }
    headers['Content-Type'] = 'application/json'
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(req)
    })
    if (!response.ok) {
        const responseText = await response.text()
        throw Error(`Error fetching ${path}: ${response.status} ${responseText}`)
    }
    const resp = await response.json()
    return resp
}

const loadJsonFromUri = async (uri: string) => {
    const url = getUrlFromUri(uri)
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Error loading from source: ${response.statusText}`)
    }
    const json = await response.json()
    return json
}

const getUrlFromUri = (uri: string) => {
    if (uri.startsWith('https://github.com/')) {
        const raw_url = uri.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
        return raw_url + `?cachebust=${randomString(5)}`
    }
    else {
        return uri
    }
}

const randomString = (length: number) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}