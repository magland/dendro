import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../useRoute"

type ServiceAppNameComponentProps = {
    serviceName: string
    appName: string
}

const ServiceAppNameComponent: FunctionComponent<ServiceAppNameComponentProps> = ({ serviceName, appName }) => {
    const { setRoute } = useRoute()
    const serviceAppNameDisplay = appName
    return (
        <Hyperlink
            onClick={() => {
                setRoute({page: 'service_app', serviceName, appName})
            }}
            color='#363'
        >{serviceAppNameDisplay}</Hyperlink>
    )
}

export default ServiceAppNameComponent