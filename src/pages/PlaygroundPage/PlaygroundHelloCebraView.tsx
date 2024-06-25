import { FunctionComponent } from "react"

type PlaygroundHelloCebraViewProps = {
    serviceName: string
    appName: string
}

const PlaygroundHelloCebraView: FunctionComponent<PlaygroundHelloCebraViewProps> = () => {
    return (
        <div>
            <h3>Hello CEBRA</h3>
        </div>
    )
}

export default PlaygroundHelloCebraView