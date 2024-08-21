import {
  FunctionComponent,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LoginContext } from "./LoginContext";

type SetupLoginProps = {
  //
};

export const SetupLogin: FunctionComponent<
  PropsWithChildren<SetupLoginProps>
> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [githubAccessToken, setGitHubAccessToken] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const check = () => {
      const xx = localStorage.getItem("dendro_github_access_token");
      if (!xx) {
        setGitHubAccessToken(null);
        return;
      }
      let accessToken: string | undefined = undefined;
      try {
        accessToken = JSON.parse(xx).accessToken;
      } catch {
        setGitHubAccessToken(null);
        return;
      }
      if (!accessToken) {
        setGitHubAccessToken(null);
        return;
      }
      setGitHubAccessToken(accessToken);
    };
    const timer = setInterval(() => {
      check();
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!githubAccessToken) {
      setUserId(null);
      return;
    }
    let canceled = false;
    (async () => {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${githubAccessToken}`,
        },
      });
      if (canceled) {
        return;
      }
      if (!response.ok) {
        setUserId(null);
        return;
      }
      const data = await response.json();
      if (canceled) {
        return;
      }
      setUserId("github|" + data.login);
    })();
    return () => {
      canceled = true;
    };
  }, [githubAccessToken]);
  const value = useMemo(
    () => ({
      userId,
      githubAccessToken,
      clearGithubAccessToken: () => {
        localStorage.removeItem("dendro_github_access_token");
        setGitHubAccessToken(null);
        setUserId(null);
      },
    }),
    [userId, githubAccessToken],
  );
  return (
    <LoginContext.Provider value={value}>{children}</LoginContext.Provider>
  );
};
