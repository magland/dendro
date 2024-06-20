import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent } from "react";
import { PairioServiceApp } from "../../types";
import useRoute from "../../useRoute";

type ServiceAppsTableProps = {
    serviceApps: PairioServiceApp[]
}

const ServiceAppsTable: FunctionComponent<ServiceAppsTableProps> = ({ serviceApps }) => {
    const { setRoute } = useRoute()
    return (
        <table className="table">
            <thead>
                <tr>
                    <th>App</th>
                    <th>Service</th>
                </tr>
            </thead>
            <tbody>
                {serviceApps.map((ss) => (
                    <tr key={ss.serviceName + ':' + ss.appName}>
                        <td>
                            <Hyperlink
                                onClick={() => {
                                    setRoute({page: 'service_app', serviceName: ss.serviceName, appName: ss.appName})
                                }}
                            >
                                {ss.appName}
                            </Hyperlink>
                        </td>
                        <td>{ss.serviceName}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default ServiceAppsTable