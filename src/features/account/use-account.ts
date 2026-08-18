import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useMemo, useState } from "react"
import { type AdminSession, auth, useSession } from "@/lib/auth"
import { uploadProfilePicture } from "./account.functions"
import type { AccountNotice, ActiveSession, Passkey } from "./types"

export function useAccount(initialSession: AdminSession) {
  const router = useRouter()
  const uploadProfilePictureFn = useServerFn(uploadProfilePicture)
  const sessionQuery = useSession()
  const session = sessionQuery.data ?? initialSession
  const user = session.user
  const [name, setName] = useState(user.name ?? "")
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [securityLoading, setSecurityLoading] = useState(true)
  const [securityRefreshing, setSecurityRefreshing] = useState(false)
  const [securityError, setSecurityError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<AccountNotice>(null)

  const sortedSessions = useMemo(
    () => sessions.toSorted((item) => (item.id === session.session.id ? -1 : 0)),
    [session.session.id, sessions]
  )

  const refreshSecurityData = useCallback(async (isRetry = false) => {
    if (isRetry) setSecurityRefreshing(true)
    try {
      const [passkeyResult, sessionResult] = await Promise.all([auth.passkey.listUserPasskeys(), auth.listSessions()])
      if (passkeyResult.error || sessionResult.error) {
        setSecurityError("Could not load passkeys and active sessions. Your existing security data is still shown.")
        return false
      }
      setPasskeys(passkeyResult.data ?? [])
      setSessions(sessionResult.data ?? [])
      setSecurityError("")
      return true
    } catch {
      setSecurityError("Could not load passkeys and active sessions. Your existing security data is still shown.")
      return false
    } finally {
      setSecurityLoading(false)
      if (isRetry) setSecurityRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshSecurityData()
  }, [refreshSecurityData])

  useEffect(() => setName(user.name ?? ""), [user.name])

  async function updateName(event: React.FormEvent) {
    event.preventDefault()
    setBusy("name")
    setNotice(null)
    try {
      const result = await auth.updateUser({ name: name.trim() })
      if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not update your name." })
      else {
        await sessionQuery.refetch()
        setNotice({ type: "success", text: "Profile name updated." })
      }
    } catch {
      setNotice({ type: "error", text: "Could not update your name." })
    } finally {
      setBusy(null)
    }
  }

  async function uploadImage(file?: File) {
    if (!file) return
    setNotice(null)
    if (file.size > 1024 * 1024 || !["image/png", "image/jpeg"].includes(file.type)) {
      setNotice({ type: "error", text: "Use a PNG or JPEG image smaller than 1 MB." })
      return
    }

    setBusy("image")
    const formData = new FormData()
    formData.set("image", file)
    try {
      await uploadProfilePictureFn({ data: formData })
      await sessionQuery.refetch()
      setNotice({ type: "success", text: "Profile picture updated." })
    } catch {
      setNotice({ type: "error", text: "Could not update your profile picture." })
    }
    setBusy(null)
  }

  async function removeImage() {
    setBusy("image")
    setNotice(null)
    try {
      const result = await auth.updateUser({ image: null })
      if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not remove the picture." })
      else {
        await sessionQuery.refetch()
        setNotice({ type: "success", text: "Profile picture removed." })
      }
    } catch {
      setNotice({ type: "error", text: "Could not remove the picture." })
    } finally {
      setBusy(null)
    }
  }

  async function addPasskey() {
    setBusy("passkey")
    setNotice(null)
    try {
      const result = await auth.passkey.addPasskey({ name: `Passkey ${passkeys.length + 1}` })
      if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not create the passkey." })
      else {
        const refreshed = await refreshSecurityData()
        setNotice({
          type: "success",
          text: refreshed ? "Passkey created." : "Passkey created. Refresh security data to see the updated list.",
        })
      }
    } catch {
      setNotice({ type: "error", text: "Could not create the passkey." })
    } finally {
      setBusy(null)
    }
  }

  async function deletePasskey(id: string) {
    setBusy(id)
    setNotice(null)
    try {
      const result = await auth.passkey.deletePasskey({ id })
      if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not delete the passkey." })
      else {
        const refreshed = await refreshSecurityData()
        setNotice({
          type: "success",
          text: refreshed ? "Passkey deleted." : "Passkey deleted. Refresh security data to see the updated list.",
        })
      }
    } catch {
      setNotice({ type: "error", text: "Could not delete the passkey." })
    } finally {
      setBusy(null)
    }
  }

  async function revokeOtherSessions() {
    setBusy("sessions")
    setNotice(null)
    try {
      const result = await auth.revokeOtherSessions()
      if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not revoke other sessions." })
      else {
        const refreshed = await refreshSecurityData()
        setNotice({
          type: "success",
          text: refreshed
            ? "Other sessions signed out."
            : "Sessions were signed out. Refresh security data to see the updated list.",
        })
      }
    } catch {
      setNotice({ type: "error", text: "Could not revoke other sessions." })
    } finally {
      setBusy(null)
    }
  }

  async function logout() {
    setBusy("logout")
    setNotice(null)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch {
      setNotice({ type: "error", text: "Could not sign out. Please try again." })
      setBusy(null)
    }
  }

  return {
    user,
    currentSessionId: session.session.id,
    name,
    setName,
    passkeys,
    sortedSessions,
    securityLoading,
    securityRefreshing,
    securityError,
    busy,
    notice,
    updateName,
    uploadImage,
    removeImage,
    addPasskey,
    deletePasskey,
    revokeOtherSessions,
    refreshSecurityData,
    logout,
  }
}
