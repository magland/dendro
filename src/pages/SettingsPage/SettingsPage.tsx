import { FunctionComponent, useCallback, useState } from "react"
import { ResetUserApiKeyRequest, isResetUserApiKeyResponse } from "../../types";
import { apiPostRequest } from "../../hooks";
import useRoute from "../../useRoute";
import { useLogin } from "../../LoginContext/LoginContext";
import LoginButton from "../../LoginButton";
import { Hyperlink } from "@fi-sci/misc";
import UserIdComponent from "../../components/UserIdComponent";

type SettingsPageProps = {
    // none
}

const SettingsPage: FunctionComponent<SettingsPageProps> = () => {
    const { setRoute } = useRoute();
    const { userId, githubAccessToken } = useLogin();
    const [resettingApiKey, setResettingApiKey] = useState(false);
    const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const handleResetApiKey = useCallback(async () => {
        if (!userId) throw Error('Missing userId');
        if (!githubAccessToken) throw Error('Missing githubAccessToken');
        setResettingApiKey(true);
        setGeneratedApiKey(null);
        setApiKeyCopied(false);
        try {
            const req: ResetUserApiKeyRequest = {
                type: 'resetUserApiKeyRequest',
                userId
            }
            const resp = await apiPostRequest('resetUserApiKey', req, githubAccessToken);
            if (!isResetUserApiKeyResponse(resp)) {
                throw Error('Unexpected response');
            }
            setGeneratedApiKey(resp.apiKey);
        }
        finally {
            setResettingApiKey(false);
        }
    }, [userId, githubAccessToken]);
    return (
        <div style={{ padding: 30 }}>
            <h3>Settings</h3>
            <Hyperlink onClick={() => {
                setRoute({ page: 'home' })
            }}>Go to Pairio home</Hyperlink>
            <hr />
            {!userId && (
                <p>
                    You are not logged in. Log in to access settings.
                </p>
            )}
            <LoginButton />
            <hr />
            {!userId && (
                <p>
                    You must be logged in to obtain an API key.
                </p>
            )}
            {userId && (
                <p style={{maxWidth: 500}}>
                    An API key is required to submit jobs. Keep your API key secret. If you generate a new API key, the old key will no longer work.
                    You may want to set a PAIRIO_API_KEY environment variable on your system.
                </p>
            )}
            {userId && !resettingApiKey && (
                <button onClick={handleResetApiKey}>
                    Generate API Key for <UserIdComponent userId={userId} followLink={false} />
                </button>
            )}
            {resettingApiKey && (
                <p>Generating API key...</p>
            )}
            {generatedApiKey && !resettingApiKey && (
                <div>
                    <p>API key generated:</p>
                    <pre>{generatedApiKey}</pre>
                    {!apiKeyCopied && (
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(generatedApiKey);
                        }}
                    >
                        Copy API key to clipboard
                    </button>)}
                    {apiKeyCopied && (
                        <p>API key copied to clipboard</p>
                    )}
                </div>
            )}
        </div>
    )
}

export default SettingsPage