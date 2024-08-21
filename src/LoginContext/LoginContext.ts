import { createContext, useContext } from "react";

type LoginContextType = {
  userId: string | null;
  githubAccessToken: string | null;
  clearGithubAccessToken: () => void;
};

export const LoginContext = createContext<LoginContextType | null>(null);

export const useLogin = () => {
  const loginContext = useContext(LoginContext);
  if (!loginContext) {
    throw new Error("LoginContext not found");
  }
  return loginContext;
};
