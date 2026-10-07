import { useRouter } from "@tanstack/react-router"
import { useCallback, useState } from "react"

import { auth } from "@/lib/auth"

import { appToast } from "./toast"

/** Signs out of this device and lands on /login; a failure toasts and leaves the user where they are. */
export function useSignOut() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const signOut = useCallback(async () => {
    setPending(true)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't sign out. Try again.")
      setPending(false)
    }
  }, [router])

  return { signOut, pending }
}
