import { createAuthClient } from "better-auth/react";
import { AUTH_PATH } from "@polinetwork/backend";
import { getBaseUrl } from "./utils";

export const auth = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: AUTH_PATH,
});

export const { signIn, signOut, getSession, useSession } = auth;
