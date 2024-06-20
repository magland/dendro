import { FunctionComponent, useCallback } from "react";
import LoginButton from "../../LoginButton";
import { Hyperlink } from "@fi-sci/misc";
import useRoute from "../../useRoute";
import { useLogin } from "../../LoginContext/LoginContext";
import { ResetUserApiKeyRequest, isResetUserApiKeyResponse } from "../../types";
import { apiPostRequest } from "../../hooks";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

const HomePage: FunctionComponent<Props> = () => {
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
    <div style={{padding: 30}}>
      <h3>Pairio - a prototype for the next Dendro</h3>
      <LoginButton />
      <hr />
      {userId && (
        <div>
          <div>
            <Hyperlink onClick={() => {
              setRoute({page: 'services'})
            }}>Services</Hyperlink>
          </div>
        </div>
      )}
      <hr />
      {userId && (
        <button onClick={handleResetApiKey}>
          Reset API Key
        </button>
      )}
    </div>
  )
};

export default HomePage;
