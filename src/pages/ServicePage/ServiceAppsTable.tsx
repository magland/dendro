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
                    <th>Processors</th>
                    <th>Description</th>
                    <th>Source</th>
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
                        <td>
                            {ss.appSpecification.processors.map(p => p.name).join(', ')}
                        </td>
                        <td>{ss.appSpecification.description}</td>
                        <td>{
                            ss.appSpecificationUri ? (
                                <a href={ss.appSpecificationUri} target="_blank" rel="noreferrer">
                                    source
                                </a>
                            ) : (
                                <span>none</span>
                            )
                        }</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default ServiceAppsTable