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
  const { userId } = useLogin();
  return (
    <div style={{padding: 30}}>
      <h3>Pairio is a prototype for the next Dendro</h3>
      <p>
        <a href="https://github.com/magland/pairio" target="_blank" rel="noopener noreferrer">Read more...</a>
      </p>
      <div>
        <LoginButton />
      </div>
      <hr />
      {userId && (
        <div>
          <div>
            <Hyperlink onClick={() => {
              setRoute({page: 'services'})
            }}>View services</Hyperlink>
          </div>
        </div>
      )}
      <hr />
      <div>
        <Hyperlink onClick={() => {
          setRoute({page: 'settings'})
        }}>View settings</Hyperlink>
      </div>
    </div>
  )
};

export default HomePage;
