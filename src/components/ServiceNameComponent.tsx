import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../useRoute"

type ServiceNameComponentProps = {
    serviceName: string
}

const ServiceNameComponent: FunctionComponent<ServiceNameComponentProps> = ({ serviceName }) => {
    const { setRoute } = useRoute()
    const serviceNameDisplay = serviceName
    return (
        <Hyperlink
            onClick={() => {
                setRoute({page: 'service', serviceName: serviceName})
            }}
            color='#633'
        >{serviceNameDisplay}</Hyperlink>
    )
}

export default ServiceNameComponent