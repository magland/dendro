import { FunctionComponent, useCallback } from "react"
import { ResetUserApiKeyRequest, isResetUserApiKeyResponse } from "../../types";
import { apiPostRequest } from "../../hooks";
import useRoute from "../../useRoute";
import { useLogin } from "../../LoginContext/LoginContext";
import LoginButton from "../../LoginButton";
import { Hyperlink } from "@fi-sci/misc";

type SettingsPageProps = {
    // none
}

const SettingsPage: FunctionComponent<SettingsPageProps> = () => {
    const { setRoute } = useRoute();
    const { userId, githubAccessToken } = useLogin();
    const handleResetApiKey = useCallback(async () => {
        if (!userId) throw Error('Missing userId');
        if (!githubAccessToken) throw Error('Missing githubAccessToken');
        const req: ResetUserApiKeyRequest = {
            type: 'resetUserApiKeyRequest',
            userId
        }
        const resp = await apiPostRequest('resetUserApiKey', req, githubAccessToken);
        if (!isResetUserApiKeyResponse(resp)) {
            throw Error('Unexpected response');
        }
        alert(`New API key: ${resp.apiKey}`)
    }, [userId, githubAccessToken]);
    return (
        <div style={{ padding: 30 }}>
            <h3>Settings</h3>
            <Hyperlink onClick={() => {
                setRoute({ page: 'home' })
            }}>Pairio home</Hyperlink>
            <hr />
            <LoginButton />
            <hr />
            {userId && (
                <button onClick={handleResetApiKey}>
                    Reset API Key
                </button>
            )}
        </div>
    )
}

export default SettingsPage