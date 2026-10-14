import { useRouter } from "@tanstack/react-router"

import { appToast } from "@/components/shell"

/**
 * After a successful mutation: reload every loader, then confirm. A failed reload is not a failed mutation, so it
 * warns instead of offering to repeat it.
 */
export function useRefreshAfter() {
  const router = useRouter()
  return async (message: string) => {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning(`${message.replace(/\.$/, "")}, but the page couldn't refresh.`)
      return
    }
    appToast.success(message)
  }
}

/** The message to show for a failed call: the backend's own words, or a generic fallback. */
export function errorMessage(caught: Error, fallback: string) {
  return caught.message === "" || caught.message === "UNAUTHORIZED" ? fallback : caught.message
}
