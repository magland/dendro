/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink, SmallIconButton } from "@fi-sci/misc"
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { useService } from "../../hooks"
import useRoute from "../../useRoute"
import ComputeClientsView from "./ComputeClientsView"
import ServiceAppsView from "./ServiceAppsView"
import JobsView from "../ComputeClientPage/JobsView"
import { PairioService, PairioServiceUser } from "../../types"
import { Add, Delete } from "@mui/icons-material"

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
    const { service, deleteService, setServiceInfo } = useService(serviceName)
    const [editingUsers, setEditingUsers] = useState(false)

    const setUsers = useCallback(async (users: PairioServiceUser[]) => {
        await setServiceInfo({users})
    }, [setServiceInfo])

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
                        <td>
                            <Hyperlink onClick={() => setEditingUsers(true)}>
                                Edit users
                            </Hyperlink>
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
            {
                editingUsers && (
                    <EditUsersControl service={service} onSetUsers={users => setUsers(users)} />
                )
            }
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

type EditUsersControlProps = {
    service: PairioService
    onSetUsers: (users: PairioServiceUser[]) => Promise<void>
}

const EditUsersControl: FunctionComponent<EditUsersControlProps> = ({service, onSetUsers}) => {
    const [localEditUsers, setLocalEditUsers] = useState<PairioServiceUser[]>(service.users)
    useEffect(() => {
        setLocalEditUsers(service.users)
    }, [service])
    const somethingChanged = useMemo(() => {
        return deterministicHash(localEditUsers) !== deterministicHash(service.users)
    }, [localEditUsers, service])
    return (
        <div>
            <div>
                <SmallIconButton
                    icon={<Add />}
                    label="Add user"
                    onClick={() => {
                        let ghUserName = prompt('Enter the GitHub user name')
                        if (!ghUserName) return
                        if (ghUserName.startsWith('github|')) {
                            ghUserName = ghUserName.slice('github|'.length)
                        }
                        const userId = 'github|' + ghUserName
                        const newUsers = [...localEditUsers, {userId, admin: false, createJobs: true, processJobs: false}]
                        setLocalEditUsers(newUsers)
                    }}
                />
                &nbsp;
                {
                    somethingChanged && (
                        <button onClick={async () => {
                            await onSetUsers(localEditUsers)
                        }}>
                            Save changes
                        </button>
                    )
                }
            </div>
            <table className="scientific-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>User</th>
                        <th>Admin</th>
                        <th>Create jobs</th>
                        <th>Process jobs</th>
                    </tr>
                </thead>
                {
                    localEditUsers.map((user, index) => (
                        <tr key={index}>
                            <td>
                                <SmallIconButton
                                    icon={<Delete />}
                                    onClick={() => {
                                        const newUsers = [...localEditUsers]
                                        newUsers.splice(index, 1)
                                        setLocalEditUsers(newUsers)
                                    }}
                                />
                            </td>
                            <td>{user.userId}</td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={user.admin}
                                    onChange={e => {
                                        const newUsers = [...localEditUsers]
                                        newUsers[index] = {...user, admin: e.target.checked}
                                        setLocalEditUsers(newUsers)
                                    }}
                                />
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={user.createJobs}
                                    onChange={e => {
                                        const newUsers = [...localEditUsers]
                                        newUsers[index] = {...user, createJobs: e.target.checked}
                                        setLocalEditUsers(newUsers)
                                    }}
                                />
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={user.processJobs}
                                    onChange={e => {
                                        const newUsers = [...localEditUsers]
                                        newUsers[index] = {...user, processJobs: e.target.checked}
                                        setLocalEditUsers(newUsers)
                                    }}
                                />
                            </td>
                        </tr>
                    ))
                }
            </table>
        </div>
    )
}

const deterministicHash = (x: any) => {
    return JSON.stringify(x)
}

export default ServicePage