import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  Calendar,
  Camera,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  MonitorSmartphone,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { auth, useSession } from "@/lib/auth"
import type { AdminSession } from "@/server/api.functions"
import { uploadProfilePicture } from "@/server/api.functions"

type Passkey = { id: string; name?: string | null; createdAt?: Date | string; deviceType?: string }
type ActiveSession = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt?: Date | string
}

export const Route = createFileRoute("/dashboard/account")({ component: Account })

function avatarText(name?: string | null, email?: string) {
  return (name || email || "U")
    .split(/[\s.@_-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function Account() {
  const router = useRouter()
  const initial = Route.useRouteContext().session as AdminSession
  const sessionQuery = useSession()
  const session = (sessionQuery.data as AdminSession | null) ?? initial
  const user = session.user
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function refreshSecurityData() {
    const [passkeyResult, sessionResult] = await Promise.all([auth.passkey.listUserPasskeys(), auth.listSessions()])
    setPasskeys((passkeyResult.data ?? []) as Passkey[])
    setSessions((sessionResult.data ?? []) as ActiveSession[])
  }

  useEffect(() => {
    void refreshSecurityData()
  }, [refreshSecurityData])
  useEffect(() => setName(user?.name ?? ""), [user?.name])

  async function updateName(event: React.FormEvent) {
    event.preventDefault()
    setBusy("name")
    setNotice(null)
    const result = await auth.updateUser({ name: name.trim() })
    if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not update your name." })
    else {
      await sessionQuery.refetch()
      setNotice({ type: "success", text: "Profile name updated." })
    }
    setBusy(null)
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
      await uploadProfilePicture({ data: formData })
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
    const result = await auth.updateUser({ image: null })
    if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not remove the picture." })
    else {
      await sessionQuery.refetch()
      setNotice({ type: "success", text: "Profile picture removed." })
    }
    setBusy(null)
  }

  async function addPasskey() {
    setBusy("passkey")
    setNotice(null)
    const result = await auth.passkey.addPasskey({ name: `Passkey ${passkeys.length + 1}` })
    if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not create the passkey." })
    else {
      await refreshSecurityData()
      setNotice({ type: "success", text: "Passkey created." })
    }
    setBusy(null)
  }

  async function deletePasskey(id: string) {
    setBusy(id)
    setNotice(null)
    const result = await auth.passkey.deletePasskey({ id })
    if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not delete the passkey." })
    else {
      await refreshSecurityData()
      setNotice({ type: "success", text: "Passkey deleted." })
    }
    setBusy(null)
  }

  async function revokeOtherSessions() {
    setBusy("sessions")
    setNotice(null)
    const result = await auth.revokeOtherSessions()
    if (result.error) setNotice({ type: "error", text: result.error.message ?? "Could not revoke other sessions." })
    else {
      await refreshSecurityData()
      setNotice({ type: "success", text: "Other sessions signed out." })
    }
    setBusy(null)
  }

  async function logout() {
    setBusy("logout")
    await auth.signOut()
    await router.invalidate()
    await router.navigate({ to: "/login", replace: true })
  }

  return (
    <div className="account-page reveal">
      <section className="data-intro">
        <div>
          <p className="eyebrow">OPERATOR PROFILE</p>
          <h2>Account settings</h2>
          <p>Manage your profile and authentication methods.</p>
        </div>
      </section>
      {notice && <div className={`account-notice ${notice.type}`}>{notice.text}</div>}

      <section className="account-profile-card">
        <div className="account-avatar-wrap">
          {user?.image ? (
            <img className="account-avatar" src={user.image} alt="Your profile" />
          ) : (
            <span className="account-avatar fallback">{avatarText(user?.name, user?.email)}</span>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy === "image"}
            aria-label="Upload profile picture"
          >
            <Camera size={15} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(event) => void uploadImage(event.target.files?.[0])}
          />
        </div>
        <div className="account-identity">
          <h3>{user?.name || "Complete your profile"}</h3>
          <p>{user?.email}</p>
          <span>
            {user?.telegramUsername
              ? `@${user.telegramUsername}`
              : user?.telegramId
                ? `Telegram ID ${user.telegramId}`
                : "Telegram not linked"}
          </span>
        </div>
        {user?.image && (
          <button className="secondary-button danger" onClick={() => void removeImage()} disabled={busy === "image"}>
            Remove picture
          </button>
        )}
      </section>

      <div className="account-grid">
        <section className="account-panel">
          <header>
            <span>
              <UserRound size={18} />
              <div>
                <h3>Profile details</h3>
                <p>Displayed throughout the admin console.</p>
              </div>
            </span>
          </header>
          <form className="account-form" onSubmit={(event) => void updateName(event)}>
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
            <label>
              Email address
              <input value={user?.email ?? ""} disabled />
            </label>
            <button className="primary-button" disabled={busy === "name" || name.trim() === user?.name}>
              {busy === "name" && <LoaderCircle className="spin" size={14} />} Save profile
            </button>
          </form>
        </section>

        <section className="account-panel">
          <header>
            <span>
              <Mail size={18} />
              <div>
                <h3>Telegram identity</h3>
                <p>Used to determine roles and permissions.</p>
              </div>
            </span>
          </header>
          <dl className="account-details">
            <div>
              <dt>Username</dt>
              <dd>{user?.telegramUsername ? `@${user.telegramUsername}` : "Not available"}</dd>
            </div>
            <div>
              <dt>Telegram ID</dt>
              <dd className="mono">{user?.telegramId ?? "Not linked"}</dd>
            </div>
          </dl>
        </section>

        <section className="account-panel full">
          <header>
            <span>
              <KeyRound size={18} />
              <div>
                <h3>Passkeys</h3>
                <p>Phishing-resistant access from your trusted devices.</p>
              </div>
            </span>
            <button className="primary-button" onClick={() => void addPasskey()} disabled={busy === "passkey"}>
              <KeyRound size={14} /> Add passkey
            </button>
          </header>
          <div className="security-list">
            {passkeys.map((passkey) => (
              <article key={passkey.id}>
                <span className="security-icon">
                  <KeyRound size={17} />
                </span>
                <div>
                  <h4>{passkey.name || "Unnamed passkey"}</h4>
                  <p>
                    <Calendar size={12} /> Added{" "}
                    {passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : "recently"}
                    {passkey.deviceType ? ` · ${passkey.deviceType}` : ""}
                  </p>
                </div>
                <button
                  className="icon-action danger"
                  onClick={() => void deletePasskey(passkey.id)}
                  disabled={busy === passkey.id}
                  aria-label="Delete passkey"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
            {!passkeys.length && <p className="section-empty">No passkeys registered yet.</p>}
          </div>
        </section>

        <section className="account-panel full">
          <header>
            <span>
              <Shield size={18} />
              <div>
                <h3>Active sessions</h3>
                <p>Devices currently signed in to your account.</p>
              </div>
            </span>
            {sessions.length > 1 && (
              <button
                className="secondary-button"
                onClick={() => void revokeOtherSessions()}
                disabled={busy === "sessions"}
              >
                Sign out other sessions
              </button>
            )}
          </header>
          <div className="security-list">
            {sessions.map((activeSession) => (
              <article key={activeSession.id}>
                <span className="security-icon">
                  <MonitorSmartphone size={17} />
                </span>
                <div>
                  <h4>{activeSession.userAgent || "Unknown device"}</h4>
                  <p>
                    {activeSession.ipAddress || "Unknown IP"}
                    {activeSession.createdAt
                      ? ` · Since ${new Date(activeSession.createdAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {activeSession.id === session.session?.id && <span className="status-pill">Current</span>}
              </article>
            ))}
          </div>
          <button className="logout-wide" onClick={() => void logout()} disabled={busy === "logout"}>
            <LogOut size={15} /> Sign out of this device
          </button>
        </section>
      </div>
    </div>
  )
}
