import { FunctionComponent } from "react";
import ServiceNameComponent from "../../components/ServiceNameComponent";
import UserIdComponent from "../../components/UserIdComponent";
import { DendroService } from "../../types";

type ServicesTableProps = {
  services: DendroService[];
};

const ServicesTable: FunctionComponent<ServicesTableProps> = ({ services }) => {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Owner</th>
          <th>Users</th>
        </tr>
      </thead>
      <tbody>
        {services.map((service) => (
          <tr key={service.serviceName}>
            <td>
              <ServiceNameComponent serviceName={service.serviceName} />
            </td>
            <td>
              <UserIdComponent userId={service.userId} />
            </td>
            <td>
              {service.users.length === 0 ? (
                <span>none</span>
              ) : (
                service.users.map((u) => (
                  <span>
                    <UserIdComponent userId={u.userId} />
                    &nbsp;
                  </span>
                ))
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ServicesTable;
