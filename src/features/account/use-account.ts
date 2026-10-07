import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useMemo, useState } from "react"

import { appToast } from "@/components/shell"
import { type AdminSession, auth, useSession } from "@/lib/auth"

import { uploadProfilePicture } from "./account.functions"
import { isValidProfilePicture } from "./account.validation"
import type { ActiveSession, Passkey } from "./types"

export type SecurityState = "loading" | "ready" | "error"

/** better-auth client results carry failures in `error` instead of throwing. */
function assertOk<Failure>(result: { error: Failure | null }, message: string) {
  if (result.error) {
    console.error(result.error)
    throw new Error(message)
  }
}

/**
 * Passkeys and sessions from the better-auth client. The first load shows a skeleton; `reload` after a mutation
 * keeps the list on screen; `retry` keeps the error on screen with a pending Retry until it settles.
 */
function useSecurityData() {
  const [state, setState] = useState<SecurityState>("loading")
  const [retrying, setRetrying] = useState(false)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])

  const reload = useCallback(async () => {
    try {
      const [passkeyResult, sessionResult] = await Promise.all([auth.passkey.listUserPasskeys(), auth.listSessions()])
      assertOk(passkeyResult, "Couldn't load passkeys.")
      assertOk(sessionResult, "Couldn't load sessions.")
      setPasskeys(passkeyResult.data ?? [])
      setSessions(sessionResult.data ?? [])
      setState("ready")
    } catch (error) {
      console.error(error)
      setState((current) => (current === "loading" ? "error" : current))
      appToast.warning("Passkeys and sessions could not be refreshed. Try again.")
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function retry() {
    setRetrying(true)
    await reload()
    setRetrying(false)
  }

  return { state, retrying, retry, reload, passkeys, sessions }
}

/**
 * Account data and mutations. Each mutation throws an `Error` carrying the §7.2 failure copy, so confirm dialogs
 * can show it inline and the page can toast it.
 */
export function useAccount(initialSession: AdminSession) {
  const uploadProfilePictureFn = useServerFn(uploadProfilePicture)
  const sessionQuery = useSession()
  const session = sessionQuery.data ?? initialSession
  const currentSessionId = session.session.id
  const security = useSecurityData()
  const { reload } = security

  const sessions = useMemo(
    () => [
      ...security.sessions.filter((item) => item.id === currentSessionId),
      ...security.sessions.filter((item) => item.id !== currentSessionId),
    ],
    [currentSessionId, security.sessions]
  )

  async function updateName(name: string) {
    assertOk(await auth.updateUser({ name }), "Couldn't update your name.")
    await sessionQuery.refetch()
  }

  /** Rejects files the server would refuse before uploading; returns false for them. */
  async function uploadImage(file: File) {
    if (!isValidProfilePicture(file)) return false
    const formData = new FormData()
    formData.set("image", file)
    try {
      await uploadProfilePictureFn({ data: formData })
    } catch (error) {
      console.error(error)
      throw new Error("Couldn't update your profile picture.")
    }
    await sessionQuery.refetch()
    return true
  }

  async function removeImage() {
    assertOk(await auth.updateUser({ image: null }), "Couldn't remove the picture.")
    await sessionQuery.refetch()
  }

  async function addPasskey() {
    assertOk(
      await auth.passkey.addPasskey({ name: `Passkey ${security.passkeys.length + 1}` }),
      "Couldn't add the passkey."
    )
    await reload()
  }

  async function deletePasskey(id: string) {
    assertOk(await auth.passkey.deletePasskey({ id }), "Couldn't delete the passkey.")
    await reload()
  }

  async function revokeOtherSessions() {
    assertOk(await auth.revokeOtherSessions(), "Couldn't sign out other sessions.")
    await reload()
  }

  return {
    user: session.user,
    currentSessionId,
    security: { state: security.state, retrying: security.retrying, retry: security.retry },
    passkeys: security.passkeys,
    sessions,
    updateName,
    uploadImage,
    removeImage,
    addPasskey,
    deletePasskey,
    revokeOtherSessions,
  }
}
