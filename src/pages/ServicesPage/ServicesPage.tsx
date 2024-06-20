/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink, SmallIconButton } from "@fi-sci/misc";
import { Add } from "@mui/icons-material";
import { FunctionComponent, useCallback } from "react";
import { useServices } from "../../hooks";
import useRoute from "../../useRoute";
import ServicesTable from "./ServicesTable";
import { useLogin } from "../../LoginContext/LoginContext";

type ServicesPageProps = {
    // none
}

const ServicesPage: FunctionComponent<ServicesPageProps> = () => {
    const { userId } = useLogin();
    const { services, addService } = useServices()
    const { setRoute } = useRoute()

    const handleAddService = useCallback(async () => {
        if (!userId) return
        const serviceName = prompt('Enter service name')
        if (!serviceName) return
        await addService(serviceName)
    }, [userId, addService])

    if (!userId) return (
        <div style={{ padding: 20 }}>
            <h3>Not logged in</h3>
        </div>
    )
    if (!services) return (
        <div style={{ padding: 20 }}>
            <h3>Loading...</h3>
        </div>
    )
    return (
        <div style={{ padding: 20 }}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'home'})
                }}>
                    Back home
                </Hyperlink>
            </div>
            <hr />
            <div>
                <SmallIconButton
                    onClick={handleAddService}
                    icon={<Add />}
                    label="Add service"
                />
            </div>
            <ServicesTable
                services={services}
            />
        </div>
    );
}

export default ServicesPage