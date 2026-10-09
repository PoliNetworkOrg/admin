import { useRouter } from "@tanstack/react-router"
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react"

import { auth } from "@/lib/auth"

import { appToast } from "./toast"

const SignOutContext = createContext<{ signOut: () => Promise<void>; pending: boolean } | null>(null)

export function SignOutProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const signOut = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate({ sync: true })
      await router.navigate({ to: "/login", replace: true })
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't sign out. Try again.")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [router])

  return <SignOutContext.Provider value={{ signOut, pending }}>{children}</SignOutContext.Provider>
}

/** Shared by the shell and Account, including a synchronous guard against concurrent sign-outs. */
export function useSignOut() {
  const context = useContext(SignOutContext)
  if (!context) throw new Error("useSignOut must be rendered inside DashboardShell.")
  return context
}
