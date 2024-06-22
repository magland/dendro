import { FunctionComponent } from "react";
import ComputeClientNameComponent from "../../components/ComputeClientNameComponent";
import ServiceNameComponent from "../../components/ServiceNameComponent";
import UserIdComponent from "../../components/UserIdComponent";
import { timeAgoString } from "../../timeStrings";
import { PairioComputeClient } from "../../types";

type ComputeClientsTableProps = {
    computeClients: PairioComputeClient[]
}

const ComputeClientsTable: FunctionComponent<ComputeClientsTableProps> = ({ computeClients }) => {
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
                            <ComputeClientNameComponent
                                computeClientId={cc.computeClientId}
                                computeClientName={cc.computeClientName}
                            />
                        </td>
                        <td><ServiceNameComponent serviceName={cc.serviceName} /></td>
                        <td><UserIdComponent userId={cc.userId} /></td>
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