import { passkeyClient } from "@better-auth/passkey/client"
import { AUTH_PATH, type TelegramPlugin } from "@polinetwork/backend"
import type { BetterAuthClientPlugin } from "better-auth"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const telegramPlugin = () =>
  ({ id: "telegram", $InferServerPlugin: {} as ReturnType<TelegramPlugin> }) satisfies BetterAuthClientPlugin

export const auth = createAuthClient({
  baseURL: process.env.BACKEND_URL ?? "http://localhost:3000",
  basePath: AUTH_PATH,
  plugins: [telegramPlugin(), emailOTPClient(), passkeyClient()],
})

export const { signIn, signOut, useSession } = auth
