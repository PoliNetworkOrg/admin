import { passkeyClient } from "@better-auth/passkey/client"
import type { TelegramPlugin } from "@polinetwork/backend"
import type { BetterAuthClientPlugin } from "better-auth"
import { emailOTPClient } from "better-auth/client/plugins"

const telegramPlugin = () => {
  // SAFETY: Better Auth reads this empty property only for TelegramPlugin type inference; it has no runtime value.
  return { id: "telegram", $InferServerPlugin: {} as ReturnType<TelegramPlugin> } satisfies BetterAuthClientPlugin
}

export function createAuthPlugins() {
  return [telegramPlugin(), emailOTPClient(), passkeyClient()]
}
