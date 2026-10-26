import { createContext, type ReactNode, type RefObject, useContext, useLayoutEffect, useRef, useState } from "react"

import { type SignOptions, useSigning } from "./sign-with-cie"

type Signing = ReturnType<typeof useSigning>

type Host = {
  signing: Signing
  /** The options of the page that started the current attempt. */
  owner: RefObject<SignOptions> | null
  claim: (options: RefObject<SignOptions>) => void
}

const HostContext = createContext<Host | null>(null)

const NONE: SignOptions = { items: [] }

/**
 * Holds a signing dialog above the routes, for pages that a finished signature replaces: New request lands on the
 * request it created, a batch on To sign. The dialog and the agent window stay up while the next page loads under
 * them, and close once it is ready.
 */
export function EsignSigningHost({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<RefObject<SignOptions> | null>(null)
  const ownerRef = useRef(owner)
  // Read when an option is needed, so a hand-off still reaches the page that started it after that page is gone.
  const signing = useSigning(() => ownerRef.current?.current ?? NONE)
  const claim = (options: RefObject<SignOptions>) => {
    ownerRef.current = options
    setOwner(options)
  }
  return (
    <HostContext.Provider value={{ signing, owner, claim }}>
      {children}
      {signing.dialog}
    </HostContext.Provider>
  )
}

/**
 * `useSignWithCie` for a page that navigates away once the signature is saved: its dialog lives in
 * `EsignSigningHost`, so `handOff` may navigate and wait for the next page. Returns no `dialog` to render.
 */
export function useHostedSignWithCie(options: SignOptions): Omit<Signing, "dialog"> & { dialog: null } {
  const host = useContext(HostContext)
  if (!host) throw new Error("useHostedSignWithCie needs an EsignSigningHost above it")
  const ref = useRef(options)
  useLayoutEffect(() => {
    ref.current = options
  })
  const mine = host.owner === ref
  return {
    ...host.signing,
    start: () => {
      host.claim(ref)
      host.signing.start()
    },
    // Another page's attempt isn't this trigger's.
    creating: mine && host.signing.creating,
    error: mine ? host.signing.error : null,
    dialog: null,
  }
}
