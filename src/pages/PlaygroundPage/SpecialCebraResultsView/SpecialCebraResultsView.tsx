import { FunctionComponent, useEffect, useMemo, useState } from "react"
import { PairioJob } from "../../../types"
import { RemoteH5File } from "../../../RemoteH5File/RemoteH5File"
import LossPlot from "./LossPlot"

type SpecialCebraResultsViewProps = {
    job: PairioJob
}

const SpecialCebraResultsView: FunctionComponent<SpecialCebraResultsViewProps> = ({ job }) => {
    const outputUrl = useMemo(() => {
        const oo = job.outputFileResults.find(x => x.name === 'output')
        if (!oo) return undefined
        return oo.url
    }, [job])

    if (!outputUrl) {
        return <div>No output found</div>
    }

    return (
        <SpecialCebraResultsViewChild
            outputUrl={outputUrl}
        />
    )
}

type SpecialCebraResultsViewChildProps = {
    outputUrl: string
}

const SpecialCebraResultsViewChild: FunctionComponent<SpecialCebraResultsViewChildProps> = ({ outputUrl }) => {
    const h5 = useRemoteH5File(outputUrl)
    const loss = useLoss(h5)
    if (!h5) return <div>Loading...</div>
    if (!loss) return <div>Loading loss...</div>
    return (
        <LossPlot
            loss={loss}
            width={800}
            height={400}
        />
    )
}

const useLoss = (h5: RemoteH5File | null) => {
    const [loss, setLoss] = useState<any | null>(null)
    useEffect(() => {
        let canceled = false
        ;(async () => {
            if (!h5) return
            const l = await h5.getDatasetData('loss', {})
            if (canceled) return
            setLoss(l)
        })()
        return () => { canceled = true }
    }, [h5])

    return loss
}

const useRemoteH5File = (url: string) => {
    const [file, setFile] = useState<RemoteH5File | null>(null)
    useEffect(() => {
        let canceled = false
        ;(async () => {
            setFile(null)
            const f = new RemoteH5File(url, undefined)
            if (canceled) return
            setFile(f)
        })()
        return () => { canceled = true }
    }, [url])

    return file
}

export default SpecialCebraResultsView