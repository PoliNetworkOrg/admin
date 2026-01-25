import { AUTH_PATH, type TelegramPlugin } from "@polinetwork/backend"
import type { BetterAuthClientPlugin } from "better-auth"
import { emailOTPClient } from "better-auth/client/plugins"
import { nextCookies } from "better-auth/next-js"
import { createAuthClient } from "better-auth/react"
import { getBaseUrl } from "./utils"

const telegramPlugin = () => {
  return {
    id: "telegram",
    $InferServerPlugin: {} as ReturnType<TelegramPlugin>,
  } satisfies BetterAuthClientPlugin
}

export const auth = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: AUTH_PATH,
  plugins: [telegramPlugin(), emailOTPClient(), nextCookies()],
})

export const { signIn, signOut, getSession, useSession } = auth
