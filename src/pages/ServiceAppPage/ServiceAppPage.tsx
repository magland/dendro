/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../../useRoute"
import { useServiceApp } from "../../hooks"

type ServiceAppPageProps = {
    // none
}

const ServiceAppPage: FunctionComponent<ServiceAppPageProps> = () => {
    const { route, setRoute } = useRoute()
    // const [errorMessage, setErrorMessage] = useState<string | null>(null)
    if (route.page !== 'service_app') {
        throw new Error('Invalid route')
    }
    const serviceName = route.serviceName
    const appName = route.appName
    const { serviceApp, updateFromSource } = useServiceApp(serviceName, appName)
    if (!serviceApp) {
        return (
            <div style={{padding: 20}}>
                <h3>Loading...</h3>
            </div>
        )
    }
    return (
        <div style={{padding: 20, maxWidth: 500}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'service', serviceName})
                }}>
                    Back to service
                </Hyperlink>
            </div>
            <hr />
            <table className="table">
                <tbody>
                    <tr>
                        <td>Service</td>
                        <td>{serviceName}</td>
                    </tr>
                    <tr>
                        <td>App</td>
                        <td>{appName}</td>
                    </tr>
                    <tr>
                        <td>Source</td>
                        <td>
                            <div>
                                {serviceApp.appSpecificationUri}
                            </div>

                            {serviceApp.appSpecificationUri && (
                                <div>
                                    <Hyperlink
                                        onClick={() => {
                                            updateFromSource()
                                        }}
                                    >
                                        Update from source
                                    </Hyperlink>
                                </div>
                            )}
                        </td>
                    </tr>
                    <tr>
                        <td>Processors</td>
                        <td>
                            {
                                serviceApp.appSpecification.processors.map((processor: any) => (
                                    <div key={processor.name}>
                                        {processor.name}
                                    </div>
                                ))
                            }
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}

export default ServiceAppPage