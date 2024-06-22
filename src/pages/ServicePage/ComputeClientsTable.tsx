import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent } from "react";
import { PairioComputeClient } from "../../types";
import useRoute from "../../useRoute";
import { timeAgoString } from "../../timeStrings";

type ComputeClientsTableProps = {
    computeClients: PairioComputeClient[]
}

const ComputeClientsTable: FunctionComponent<ComputeClientsTableProps> = ({ computeClients }) => {
    const { setRoute } = useRoute()
    return (
        <table className="table">
            <thead>
                <tr>
                    <th>Compute client</th>
                    <th>Service</th>
                    <th>Owner</th>
                    <th>Last active</th>
                </tr>
            </thead>
            <tbody>
                {computeClients.map((cc) => (
                    <tr key={cc.computeClientId}>
                        <td>
                            <Hyperlink
                                onClick={() => {
                                    setRoute({page: 'compute_client', computeClientId: cc.computeClientId})
                                }}
                            >
                                {cc.computeClientName} ({cc.computeClientId})
                            </Hyperlink>
                        </td>
                        <td>{cc.serviceName}</td>
                        <td>{cc.userId}</td>
                        <td>{
                            cc.timestampLastActiveSec ? timeAgoString(cc.timestampLastActiveSec) : 'never'
                        }</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default ComputeClientsTable