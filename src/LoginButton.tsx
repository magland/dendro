import React from "react";
import { useLogin } from "./LoginContext/LoginContext";
import UserIdComponent from "./components/UserIdComponent";

const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const redirectUri = "https://dendro.vercel.app/api/auth";
export const loginUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;

const LoginButton: React.FC = () => {
  const { githubAccessToken, clearGithubAccessToken, userId } = useLogin();

  if (!githubAccessToken) {
    return <a href={loginUrl}>Log in with GitHub</a>;
  } else {
    return (
      <div>
        <p>
          Logged in as <UserIdComponent userId={userId || ""} />
        </p>
        <button onClick={clearGithubAccessToken}>Log out</button>
      </div>
    );
  }
};

export default LoginButton;
