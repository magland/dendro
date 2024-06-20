import { FunctionComponent, useEffect } from "react"
import { loginUrl } from "./LoginButton"

type Props = {
    // none
}

const LogInPage: FunctionComponent<Props> = () => {
    useEffect(() => {
        window.open(loginUrl, '_self')
    }, [])
    return <div>Logging in...</div>
}

export default LogInPage