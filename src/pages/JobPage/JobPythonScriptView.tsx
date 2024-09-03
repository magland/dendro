import { FunctionComponent, useMemo } from "react"
import { DendroJob } from "../../types"
import Markdown from "../../components/Markdown/Markdown"
import jobPythonScriptTemplate from "./jobPythonScriptTemplate.py?raw"
import nunjucks from "nunjucks";

nunjucks.configure({ autoescape: false });

type JobPythonScriptViewProps = {
    job: DendroJob
}

const JobPythonScriptView: FunctionComponent<JobPythonScriptViewProps> = ({ job }) => {
    const md = useMemo(() => {
        const render = (template: string) => {
            return nunjucks.renderString(template, {job})
        }
        return `
\`\`\`python
${render(jobPythonScriptTemplate)}
\`\`\`
`
    }, [job])
    return (
        <div>
            <Markdown source={md} />
        </div>
    )
}

export default JobPythonScriptView