import { FunctionComponent } from "react";
import LoginButton from "../../LoginButton";
import { Hyperlink } from "@fi-sci/misc";
import useRoute from "../../useRoute";
import { useLogin } from "../../LoginContext/LoginContext";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

const HomePage: FunctionComponent<Props> = () => {
  const { setRoute } = useRoute();
  const { userId } = useLogin();
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
    </div>
  )
};

export default HomePage;
