/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent, useState } from "react"
import { useService } from "../../hooks"
import useRoute from "../../useRoute"
import ComputeClientsView from "./ComputeClientsView"
import ServiceAppsView from "./ServiceAppsView"
import JobsView from "../ComputeClientPage/JobsView"

type ServicePageProps = {
    width: number
    height: number
}

const ServicePage: FunctionComponent<ServicePageProps> = ({width, height}) => {
    const { route, setRoute } = useRoute()
    const [errorMessage,] = useState<string | null>(null)
    if (route.page !== 'service') {
        throw new Error('Invalid route')
    }
    const serviceName = route.serviceName
    const { service, deleteService } = useService(serviceName)

    // const handleLoadFromSource = useCallback(async () => {
    //     if (!service) return
    //     if (!app.sourceUri) return
    //     setErrorMessage(null)
    //     try {
    //         const x = await loadJsonFromUri(app.sourceUri)
    //         if (x.name !== app.appName) {
    //             throw new Error('App name does not match')
    //         }
    //         const processors = x.processors
    //         if (!isArrayOf(isPairioAppProcessor)(processors)) {
    //             throw new Error('Invalid processors')
    //         }
    //         const description = x.description
    //         if (description === undefined) {
    //             throw new Error('Missing description')
    //         }
    //         setAppInfo({
    //             processors,
    //             description
    //         })
    //     }
    //     catch(err: any) {
    //         console.error(err)
    //         setErrorMessage('Error loading from source: ' + err.message)
    //     }
    // }, [app, setAppInfo])
    if (!service) {
        return (
            <div style={{padding: 20}}>
                <h3>Loading...</h3>
            </div>
        )
    }
    return (
        <div style={{position: 'absolute', width, height, overflowY: 'auto'}}>
        <div style={{padding: 20}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'services'})
                }}>
                    Back to services
                </Hyperlink>
            </div>
            <hr />
            <table className="table" style={{maxWidth: 500}}>
                <tbody>
                    <tr>
                        <td>Service</td>
                        <td>{serviceName}</td>
                        <td />
                    </tr>
                    <tr>
                        <td>Owner</td>
                        <td>{service.userId}</td>
                        <td />
                    </tr>
                    <tr>
                        <td>Users</td>
                        <td>
                            {service.users.map((user, index) => (
                                <div key={index}>
                                    {user.userId}
                                    {user.admin && ' (admin)'}
                                    {user.createJobs && ' (create jobs)'}
                                    {user.processJobs && ' (process jobs)'}
                                </div>
                            ))}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div>&nbsp;</div>
            <div>
                {errorMessage && (
                    <div style={{color: 'red'}}>
                        {errorMessage}
                    </div>
                )}
            </div>
            <hr />
            <h3>Apps</h3>
            <ServiceAppsView serviceName={serviceName} />
            <hr />
            <h3>Compute clients</h3>
            <ComputeClientsView serviceName={serviceName} />
            <hr />
            <h3>Jobs</h3>
            <JobsView serviceName={serviceName} />
            <hr />
            <div>
                {/* Delete service */}
                <button onClick={async () => {
                    if (!window.confirm(`Delete service ${serviceName}?`)) return
                    await deleteService()
                    setRoute({page: 'services'})
                }}>
                    Delete service
                </button>
            </div>
        </div>
        </div>
    )
}

// const loadJsonFromUri = async (uri: string) => {
//     const url = getUrlFromUri(uri)
//     const response = await fetch(url)
//     if (!response.ok) {
//         throw new Error(`Error loading from source: ${response.statusText}`)
//     }
//     const json = await response.json()
//     return json
// }

// const getUrlFromUri = (uri: string) => {
//     if (uri.startsWith('https://github.com/')) {
//         const raw_url = uri.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
//         return raw_url
//     }
//     else {
//         return uri
//     }
// }


export default ServicePage