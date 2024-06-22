/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink, SmallIconButton, isArrayOf } from "@fi-sci/misc"
import { FunctionComponent, useEffect, useMemo, useState } from "react"
import { useComputeClient } from "../../hooks"
import useRoute from "../../useRoute"
import JobsView from "./JobsView"
import { timeAgoString } from "../../timeStrings"
import ServiceNameComponent from "../../components/ServiceNameComponent"
import UserIdComponent from "../../components/UserIdComponent"
import ComputeClientNameComponent from "../../components/ComputeClientNameComponent"
import { ComputeClientComputeSlot, isComputeClientComputeSlot } from "../../types"
import yaml from 'js-yaml'
import { Edit, Save } from "@mui/icons-material"

type ComputeClientPageProps = {
    // none
}

const ComputeClientPage: FunctionComponent<ComputeClientPageProps> = () => {
    const { route, setRoute } = useRoute()
    // const [errorMessage, setErrorMessage] = useState<string | null>(null)
    if (route.page !== 'compute_client') {
        throw new Error('Invalid route')
    }
    const computeClientId = route.computeClientId
    const { computeClient, deleteComputeClient, setComputeClientInfo } = useComputeClient(computeClientId)
    if (!computeClient) {
        return (
            <div style={{padding: 20}}>
                <h3>Loading...</h3>
            </div>
        )
    }
    return (
        <div style={{padding: 20}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'service', serviceName: computeClient.serviceName})
                }}>
                    Back to service
                </Hyperlink>
            </div>
            <hr />
            <table className="table" style={{maxWidth: 500}}>
                <tbody>
                    <tr>
                        <td>Compute client</td>
                        <td><ComputeClientNameComponent computeClientId={computeClientId} computeClientName={computeClient.computeClientName} /></td>
                        <td />
                    </tr>
                    <tr>
                        <td>ID</td>
                        <td>{computeClient.computeClientId}</td>
                        <td />
                    </tr>
                    <tr>
                        <td>User</td>
                        <td><UserIdComponent userId={computeClient.userId} /></td>
                        <td />
                    </tr>
                    <tr>
                        <td>Service</td>
                        <td><ServiceNameComponent serviceName={computeClient.serviceName} /></td>
                    </tr>
                    <tr>
                        <td>Description</td>
                        <td>{computeClient.description}</td>
                        <td />
                    </tr>
                    <tr>
                        <td>Compute slots</td>
                        <td>
                            <ComputeSlotsView
                                computeSlots={computeClient.computeSlots} editable={true}
                                onSetComputeSlots={(computeSlots) => {
                                    setComputeClientInfo({computeSlots})
                                }}
                            />
                        </td>
                        <td />
                    </tr>
                    <tr>
                        <td>Last active</td>
                        <td>{timeAgoString(computeClient.timestampLastActiveSec)}</td>
                    </tr>
                </tbody>
            </table>
            <hr />
            {/* <div>
                {errorMessage && (
                    <div style={{color: 'red'}}>
                        {errorMessage}
                    </div>
                )}
            </div> */}
            <h3>Jobs</h3>
            <JobsView
                computeClientId={computeClientId}
                serviceName={computeClient.serviceName}
            />
            <hr />
            <div>
                {/* Delete computeClient */}
                <button onClick={async () => {
                    if (!window.confirm(`Delete computeClient ${computeClient.computeClientName}?`)) return
                    await deleteComputeClient()
                    setRoute({page: 'service', serviceName: computeClient.serviceName})
                }}>
                    Delete compute client
                </button>
            </div>
        </div>
    )
}

type ComputeSlotsViewProps = {
    computeSlots: ComputeClientComputeSlot[]
    editable: boolean
    onSetComputeSlots: (computeSlots: ComputeClientComputeSlot[]) => void
}

const ComputeSlotsView: FunctionComponent<ComputeSlotsViewProps> = ({ computeSlots, editable, onSetComputeSlots }) => {
    const [editing, setEditing] = useState<boolean>(false)
    const [editedYaml, setEditedYaml] = useState<string>('')
    useEffect(() => {
        if (!editable) {
            setEditing(false)
        }
    }, [editable])
    const computeSlotsYaml = useMemo(() => {
        return jsonToYaml(computeSlots)
    }, [computeSlots])
    useEffect(() => {
        setEditedYaml(computeSlotsYaml)
    }, [computeSlotsYaml])
    if (editing) {
        return (
            <div>
                <div>
                    <SmallIconButton
                        icon={<Save />}
                        title="Save compute slots"
                        onClick={() => {
                            const slots = yaml.load(editedYaml)
                            if (!isArrayOf(isComputeClientComputeSlot)(slots)) {
                                alert('Invalid compute slots')
                                return
                            }
                            onSetComputeSlots(slots as ComputeClientComputeSlot[])
                            setEditing(false)
                        }}
                    />
                </div>
                <div>
                    <textarea
                        value={editedYaml}
                        onChange={evt => {
                            setEditedYaml(evt.target.value)
                        }}
                        style={{width: '100%', height: 200}}
                    />
                </div>
            </div>
        )
    }
    else {
        return (
            <div>
                {editable && <div>
                    {!editing && (
                        <SmallIconButton
                            icon={<Edit />}
                            title="Edit compute slots"
                            onClick={() => {
                                setEditing(true)
                            }}
                        />
                    )}
                </div>}
                <pre>
                    {jsonToYaml(computeSlots)}
                </pre>
            </div>
        )
    }
}

const jsonToYaml = (x: any) => {
    return yaml.dump(x)
}

export default ComputeClientPage