import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent } from "react";
import { PairioService } from "../../types";
import useRoute from "../../useRoute";

type ServicesTableProps = {
    services: PairioService[]
}

const ServicesTable: FunctionComponent<ServicesTableProps> = ({ services }) => {
    const { setRoute } = useRoute()
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
                            <Hyperlink
                                onClick={() => {
                                    setRoute({page: 'service', serviceName: service.serviceName})
                                }}
                            >
                                {service.serviceName}
                            </Hyperlink>
                        </td>
                        <td>{service.userId}</td>
                        <td>{service.users.map(u => (u.userId)).join(' ')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default ServicesTable