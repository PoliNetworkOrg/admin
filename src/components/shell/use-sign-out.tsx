import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react"

import { submitSignOut } from "@/lib/sign-out"

const SignOutContext = createContext<{ signOut: () => void; pending: boolean } | null>(null)

export function SignOutProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  // The page navigates away (to the IdP's end-session endpoint), so `pending` is never reset.
  const signOut = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    submitSignOut()
  }, [])

  return <SignOutContext.Provider value={{ signOut, pending }}>{children}</SignOutContext.Provider>
}

/** Shared by the shell and Account, including a synchronous guard against concurrent sign-outs. */
export function useSignOut() {
  const context = useContext(SignOutContext)
  if (!context) throw new Error("useSignOut must be rendered inside DashboardShell.")
  return context
}
