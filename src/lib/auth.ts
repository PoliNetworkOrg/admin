import { createAuthClient } from "better-auth/react";
import { AUTH_PATH, type TelegramPlugin } from "@polinetwork/backend";
import { getBaseUrl } from "./utils";
import type { BetterAuthClientPlugin } from "better-auth";

const telegramPlugin = () => {
  return {
    id: "telegram",
    $InferServerPlugin: {} as ReturnType<TelegramPlugin>,
  } satisfies BetterAuthClientPlugin;
};

export const auth = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: AUTH_PATH,
  plugins: [telegramPlugin()],
});

export const { signIn, signOut, getSession, useSession } = auth;
