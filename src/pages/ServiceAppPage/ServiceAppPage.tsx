/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent, useMemo } from "react"
import useRoute from "../../useRoute"
import { useServiceApp } from "../../hooks"
import { PairioAppProcessor } from "../../types"

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
        <div style={{padding: 20}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'service', serviceName})
                }}>
                    Back to service
                </Hyperlink>
            </div>
            <hr />
            <table className="table" style={{maxWidth: 500}}>
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
                </tbody>
            </table>
            <hr />
            <h3>Processors</h3>
            {
                serviceApp.appSpecification.processors.map((processor) => (
                    <ProcessorView processor={processor} key={processor.name} />
                ))
            }
        </div>
    )
}

type ProcessorViewProps = {
    processor: PairioAppProcessor
}

type ProcessorViewRow = {
    type: 'input' | 'output' | 'parameter'
    name: string
    description: string
    parameterType: string | undefined
    defaultValue: any | undefined
}

const ProcessorView: FunctionComponent<ProcessorViewProps> = ({processor}) => {
    const rows: ProcessorViewRow[] = useMemo(() => {
        const r: ProcessorViewRow[] = []
        for (const x of processor.inputs) {
            r.push({
                type: 'input',
                name: x.name,
                description: x.description,
                parameterType: undefined,
                defaultValue: undefined
            })
        }
        for (const x of processor.outputs) {
            r.push({
                type: 'output',
                name: x.name,
                description: x.description,
                parameterType: undefined,
                defaultValue: undefined
            })
        }
        for (const x of processor.parameters) {
            r.push({
                type: 'parameter',
                name: x.name,
                description: x.description,
                parameterType: x.type,
                defaultValue: x.defaultValue
            })
        }
        return r
    }, [processor])
    return (
        <div>
            <h4>{processor.name}</h4>
            <p>{processor.description}</p>
            <table className="scientific-table" style={{fontSize: 12}}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Default Value</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        rows.map(row => (
                            <tr key={row.name}>
                                <td>{row.name}</td>
                                <td>{
                                    row.type === 'parameter' ? (
                                        row.parameterType
                                    ) : (
                                        row.type
                                    )
                                }</td>
                                <td>{row.defaultValue}</td>
                                <td>{row.description}</td>
                            </tr>
                        ))
                    }
                </tbody>
            </table>
        </div>
    )
}

export default ServiceAppPage