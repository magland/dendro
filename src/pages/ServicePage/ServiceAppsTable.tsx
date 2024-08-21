import { FunctionComponent } from "react";
import ServiceAppNameComponent from "../../components/ServiceAppNameComponent";
import ServiceNameComponent from "../../components/ServiceNameComponent";
import { DendroServiceApp } from "../../types";

type ServiceAppsTableProps = {
  serviceApps: DendroServiceApp[];
};

const ServiceAppsTable: FunctionComponent<ServiceAppsTableProps> = ({
  serviceApps,
}) => {
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
          <tr key={ss.serviceName + ":" + ss.appName}>
            <td>
              <ServiceAppNameComponent
                serviceName={ss.serviceName}
                appName={ss.appName}
              />
            </td>
            <td>
              <ServiceNameComponent serviceName={ss.serviceName} />
            </td>
            <td>
              {ss.appSpecification.processors.map((p) => p.name).join(", ")}
            </td>
            <td>{ss.appSpecification.description}</td>
            <td>
              {ss.appSpecificationUri ? (
                <a
                  href={ss.appSpecificationUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  source
                </a>
              ) : (
                <span>none</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ServiceAppsTable;
