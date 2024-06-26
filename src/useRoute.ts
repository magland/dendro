import { useCallback, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export type Route = {
    page: 'home'
} | {
    page: 'services'
} | {
    page: 'service'
    serviceName: string
} | {
    page: 'compute_client'
    computeClientId: string
} | {
    page: 'service_app'
    serviceName: string
    appName: string
} | {
    page: 'set_access_token'
    accessToken: string
} | {
    page: 'logIn'
} | {
    page: 'register_compute_client'
    serviceName: string
    computeClientName: string
} | {
    page: 'job'
    jobId: string
} | {
    page: 'settings'
} | {
    page: 'user'
    userId: string
} | {
    page: 'playground'
    serviceName?: string
    appName?: string
    processorName?: string
    jobDefinition?: any
    title?: string
    notes?: string
}

const useRoute = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const p = location.pathname
    const search = location.search
    const searchParams = useMemo(() => new URLSearchParams(search), [search])
    const route: Route = useMemo(() => {
        if (p === '/services') {
            return {
                page: 'services'
            }
        }
        else if (p.startsWith('/service/')) {
            const serviceName = p.slice('/service/'.length)
            return {
                page: 'service',
                serviceName
            }
        }
        else if (p.startsWith('/compute_client/')) {
            const computeClientId = p.slice('/compute_client/'.length)
            return {
                page: 'compute_client',
                computeClientId
            }
        }
        else if (p.startsWith('/service_app/')) {
            const parts = p.slice('/service_app/'.length).split('/')
            if (parts.length !== 2) {
                throw new Error(`Invalid service app URL: ${p}`)
            }
            const serviceName = parts[0]
            const appName = parts[1]
            return {
                page: 'service_app',
                serviceName,
                appName
            }
        }
        else if (p === '/set_access_token') {
            const accessToken = searchParams.get('access_token')
            if (!accessToken) {
                throw new Error('Missing access token')
            }
            return {
                page: 'set_access_token',
                accessToken
            }
        }
        else if (p === '/logIn') {
            return {
                page: 'logIn'
            }
        }
        else if (p.startsWith('/register_compute_client/')) {
            const parts = p.slice('/register_compute_client/'.length).split('/')
            if (parts.length !== 2) {
                throw new Error(`Invalid register compute client URL: ${p}`)
            }
            const serviceName = parts[0]
            const computeClientName = parts[1]
            return {
                page: 'register_compute_client',
                serviceName,
                computeClientName
            }
        }
        else if (p.startsWith('/job/')) {
            const jobId = p.slice('/job/'.length)
            return {
                page: 'job',
                jobId
            }
        }
        else if (p === '/settings') {
            return {
                page: 'settings'
            }
        }
        else if (p.startsWith('/user/')) {
            const parts = p.slice('/user/'.length).split('/')
            if (parts[0] === 'github') {
                return {
                    page: 'user',
                    userId: `github|${parts[1]}`
                }
            }
            else {
                return {
                    page: 'user',
                    userId: parts[0]
                }
            }
        }
        else if (p === '/playground') {
            const serviceName = searchParams.get('service') || undefined
            const appName = searchParams.get('app') || undefined
            const processorName = searchParams.get('processor') || undefined
            const jobDefinitionJson = searchParams.get('job_definition')
            const jobDefinition = jobDefinitionJson ? JSON.parse(decodeURIComponent(jobDefinitionJson)) : undefined
            const titleText = searchParams.get('title') || undefined
            const title = titleText ? decodeURIComponent(titleText) : undefined
            const notesText = searchParams.get('notes') || undefined
            const notes = notesText ? decodeURIComponent(notesText) : undefined
            return {
                page: 'playground',
                serviceName,
                appName,
                processorName,
                jobDefinition,
                title,
                notes
            }
        }
        else {
            return {
                page: 'home'
            }
        }
    }, [p, searchParams])

    const setRoute = useCallback((r: Route) => {
        if (r.page === 'home') {
            navigate('/')
        }
        else if (r.page === 'services') {
            navigate('/services')
        }
        else if (r.page === 'service') {
            navigate(`/service/${r.serviceName}`)
        }
        else if (r.page === 'compute_client') {
            navigate(`/compute_client/${r.computeClientId}`)
        }
        else if (r.page === 'service_app') {
            navigate(`/service_app/${r.serviceName}/${r.appName}`)
        }
        else if (r.page === 'set_access_token') {
            navigate(`/set_access_token?access_token=${r.accessToken}`)
        }
        else if (r.page === 'logIn') {
            navigate('/logIn')
        }
        else if (r.page === 'register_compute_client') {
            navigate(`/register_compute_client/${r.serviceName}/${r.computeClientName}`)
        }
        else if (r.page === 'job') {
            navigate(`/job/${r.jobId}`)
        }
        else if (r.page === 'settings') {
            navigate('/settings')
        }
        else if (r.page === 'user') {
            if (r.userId.startsWith('github|')) {
                navigate(`/user/github/${r.userId.slice('github|'.length)}`)
            }
            else {
                navigate(`/user/${r.userId}`)
            }
        }
        else if (r.page === 'playground') {
            const qstrs: string[] = []
            if (r.serviceName) {
                qstrs.push(`service=${r.serviceName}`)
            }
            if (r.appName) {
                qstrs.push(`app=${r.appName}`)
            }
            if (r.processorName) {
                qstrs.push(`processor=${r.processorName}`)
            }
            if (r.jobDefinition) {
                qstrs.push(`job_definition=${encodeURIComponent(JSON.stringify(r.jobDefinition))}`)
            }
            if (r.title) {
                qstrs.push(`title=${encodeURIComponent(r.title)}`)
            }
            if (r.notes) {
                qstrs.push(`notes=${encodeURIComponent(r.notes)}`)
            }
            const q = qstrs.join('&')
            navigate(`/playground?${q}`)
        }
        else {
            navigate('/')
        }
    }, [navigate])

    return {
        route,
        setRoute
    }
}

export default useRoute