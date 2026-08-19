import { passkeyClient } from "@better-auth/passkey/client"
import type { TelegramPlugin } from "@polinetwork/backend"
import type { BetterAuthClientPlugin } from "better-auth"
import { emailOTPClient } from "better-auth/client/plugins"

const telegramPlugin = () =>
  ({ id: "telegram", $InferServerPlugin: {} as ReturnType<TelegramPlugin> }) satisfies BetterAuthClientPlugin

export function createAuthPlugins() {
  return [telegramPlugin(), emailOTPClient(), passkeyClient()]
}
