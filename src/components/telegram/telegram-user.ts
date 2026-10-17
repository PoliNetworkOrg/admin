import type { RegisteredRouter } from "@tanstack/react-router"

import { appToast } from "@/components/shell"
import type { TgUser } from "@/lib/api/types"

type TelegramUserName = Pick<TgUser, "firstName" | "lastName">

export function telegramUserName(user: TelegramUserName) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"
}

/**
 * Awaits a server function call. A transport or backend failure becomes `message`, which the dialog shows
 * inline; the backend's own error codes come back in the result and are mapped by the caller.
 */
export async function failWith<T>(call: Promise<T>, message: string): Promise<T> {
  try {
    return await call
  } catch (error) {
    console.error(error)
    throw new Error(message)
  }
}

/**
 * Reloads every matched loader before the mutation UI settles. Loader failures render the router's error
 * boundary; an unexpected invalidation exception also shows the supplied refresh warning.
 */
export async function refreshAfterMutation(router: Pick<RegisteredRouter, "invalidate">, warning: string) {
  try {
    await router.invalidate({ sync: true })
  } catch (error) {
    console.error(error)
    appToast.warning(warning)
  }
}
