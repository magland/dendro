import { SmallIconButton } from "@fi-sci/misc"
import { Add } from "@mui/icons-material"
import { FunctionComponent, useCallback } from "react"
import { useService, useServiceApps } from "../../hooks"
import ServiceAppsTable from "./ServiceAppsTable"

type ServiceAppsViewProps = {
    serviceName: string
}

export const ServiceAppsView: FunctionComponent<ServiceAppsViewProps> = ({ serviceName }) => {
    const { serviceApps, refreshServiceApps } = useServiceApps(serviceName)
    const { addServiceAppFromSourceUri } = useService(serviceName)

    const handleAddServiceApp = useCallback(async () => {
        const serviceAppSourceUri = prompt('Enter the source URI for the new service app')
        if (!serviceAppSourceUri) return
        const serviceApp = await addServiceAppFromSourceUri({sourceUri: serviceAppSourceUri})
        console.info('Added service app', serviceApp)
        refreshServiceApps()
    }, [addServiceAppFromSourceUri, refreshServiceApps])

    if (!serviceApps) {
        return (
            <div>
                <div style={{padding: 20}}>
                    <p>Loading apps for service {serviceName}...</p>
                </div>
            </div>
        )
    }
    return (
        <div>
            <div>
                <SmallIconButton
                    onClick={handleAddServiceApp}
                    icon={<Add />}
                    label="Add service app"
                />
            </div>
            <ServiceAppsTable
                serviceApps={serviceApps}
            />
        </div>
    )
}

export default ServiceAppsView