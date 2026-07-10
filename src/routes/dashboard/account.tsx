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
import { useCallback, useEffect, useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { auth, useSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
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
  const [securityLoading, setSecurityLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const refreshSecurityData = useCallback(async () => {
    try {
      const [passkeyResult, sessionResult] = await Promise.all([auth.passkey.listUserPasskeys(), auth.listSessions()])
      setPasskeys((passkeyResult.data ?? []) as Passkey[])
      setSessions((sessionResult.data ?? []) as ActiveSession[])
    } finally {
      setSecurityLoading(false)
    }
  }, [])

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
    <div className="animate-appear">
      <section className="flex flex-col items-start border-b border-border pb-6">
        <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
          OPERATOR PROFILE
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Manage your profile and authentication methods.</p>
      </section>
      {notice && (
        <div
          className={cn(
            "my-4 border px-3 py-2.5 text-[11px]",
            notice.type === "success"
              ? "border-primary/30 bg-accent text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {notice.text}
        </div>
      )}

      <Card className="mt-5 rounded-none py-0 shadow-none">
        <CardContent className="flex items-center gap-4 p-5 max-[600px]:flex-wrap">
          <div className="relative">
            <Avatar size="lg" className="size-[58px] after:border-0">
              {user?.image && <AvatarImage src={user.image} alt="Your profile" />}
              <AvatarFallback className="bg-sidebar-primary font-mono text-base text-sidebar">
                {avatarText(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="secondary"
              size="icon-xs"
              className="absolute right-[-5px] bottom-[-5px] rounded-full border border-background bg-card"
              onClick={() => fileInput.current?.click()}
              disabled={busy === "image"}
              aria-label="Upload profile picture"
            >
              <Camera />
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(event) => void uploadImage(event.target.files?.[0])}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{user?.name || "Complete your profile"}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{user?.email}</p>
            <span className="mt-1.5 block font-mono text-[10px] text-primary">
              {user?.telegramUsername
                ? `@${user.telegramUsername}`
                : user?.telegramId
                  ? `Telegram ID ${user.telegramId}`
                  : "Telegram not linked"}
            </span>
          </div>
          {user?.image && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-none text-[10px] text-destructive"
              onClick={() => void removeImage()}
              disabled={busy === "image"}
            >
              Remove picture
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
        <Card className="rounded-none py-0 shadow-none">
          <CardHeader className="flex flex-row items-start gap-3 border-b border-border p-5">
            <UserRound className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <CardTitle className="text-[13px]">Profile details</CardTitle>
              <CardDescription className="mt-1 text-[10px]">Displayed throughout the admin console.</CardDescription>
            </span>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={(event) => void updateName(event)}>
              <FieldGroup className="gap-3.5">
                <Field>
                  <FieldLabel htmlFor="full-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    Full name
                  </FieldLabel>
                  <Input
                    id="full-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor="account-email"
                    className="font-mono text-[10px] font-medium text-muted-foreground"
                  >
                    Email address
                  </FieldLabel>
                  <Input id="account-email" value={user?.email ?? ""} disabled />
                </Field>
                <Button
                  type="submit"
                  className="w-max rounded-none bg-primary text-[11px] hover:bg-primary/85"
                  disabled={busy === "name" || name.trim() === user?.name}
                >
                  {busy === "name" && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Save
                  profile
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-none py-0 shadow-none">
          <CardHeader className="flex flex-row items-start gap-3 border-b border-border p-5">
            <Mail className="mt-0.5 shrink-0 text-primary" />
            <span>
              <CardTitle className="text-[13px]">Telegram identity</CardTitle>
              <CardDescription className="mt-1 text-[10px]">Used to determine roles and permissions.</CardDescription>
            </span>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 text-xs">
            <dl className="grid gap-3">
              <div>
                <dt className="font-mono text-[10px] text-muted-foreground">Username</dt>
                <dd className="mt-1">{user?.telegramUsername ? `@${user.telegramUsername}` : "Not available"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] text-muted-foreground">Telegram ID</dt>
                <dd className="mt-1 font-mono text-[10px]">{user?.telegramId ?? "Not linked"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-none py-0 shadow-none max-[900px]:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border p-5">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <CardTitle className="text-[13px]">Passkeys</CardTitle>
                <CardDescription className="mt-1 text-[10px]">
                  Phishing-resistant access from your trusted devices.
                </CardDescription>
              </span>
            </div>
            <Button
              className="rounded-none bg-primary text-[10px] hover:bg-primary/85"
              onClick={() => void addPasskey()}
              disabled={busy === "passkey"}
            >
              <KeyRound data-icon="inline-start" /> Add passkey
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {securityLoading ? (
              <SecurityLoading rows={2} />
            ) : (
              <SecurityList>
                {passkeys.map((passkey) => (
                  <SecurityItem
                    key={passkey.id}
                    icon={KeyRound}
                    title={passkey.name || "Unnamed passkey"}
                    description={
                      <>
                        <Calendar className="size-4" /> Added{" "}
                        {passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : "recently"}
                        {passkey.deviceType ? ` · ${passkey.deviceType}` : ""}
                      </>
                    }
                    action={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-none text-destructive"
                        onClick={() => void deletePasskey(passkey.id)}
                        disabled={busy === passkey.id}
                        aria-label="Delete passkey"
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                ))}
                {!passkeys.length && (
                  <p className="px-5 py-7 text-[11px] text-muted-foreground">No passkeys registered yet.</p>
                )}
              </SecurityList>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-none py-0 shadow-none max-[900px]:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border p-5">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <CardTitle className="text-[13px]">Active sessions</CardTitle>
                <CardDescription className="mt-1 text-[10px]">
                  Devices currently signed in to your account.
                </CardDescription>
              </span>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-none text-[10px]"
                onClick={() => void revokeOtherSessions()}
                disabled={busy === "sessions"}
              >
                Sign out other sessions
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {securityLoading ? (
              <SecurityLoading rows={2} />
            ) : (
              <SecurityList>
                {sessions.map((activeSession) => (
                  <SecurityItem
                    key={activeSession.id}
                    icon={MonitorSmartphone}
                    title={activeSession.userAgent || "Unknown device"}
                    description={
                      <>
                        {activeSession.ipAddress || "Unknown IP"}
                        {activeSession.createdAt
                          ? ` · Since ${new Date(activeSession.createdAt).toLocaleDateString()}`
                          : ""}
                      </>
                    }
                    action={
                      activeSession.id === session.session?.id ? (
                        <Badge className="h-5 rounded-none px-1.5 font-mono text-[9px]">Current</Badge>
                      ) : undefined
                    }
                  />
                ))}
              </SecurityList>
            )}
            <Separator />
            <Button
              variant="ghost"
              className="m-4 rounded-none text-[11px] text-destructive"
              onClick={() => void logout()}
              disabled={busy === "logout"}
            >
              <LogOut data-icon="inline-start" /> Sign out of this device
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SecurityList({ children }: { children: React.ReactNode }) {
  return <div className="grid">{children}</div>
}

function SecurityLoading({ rows }: { rows: number }) {
  return (
    <div className="grid" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0">
          <Skeleton className="size-7 rounded-none" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40 max-w-full rounded-none" />
            <Skeleton className="h-2.5 w-56 max-w-full rounded-none" />
          </div>
          <Skeleton className="size-7 rounded-none" />
        </div>
      ))}
    </div>
  )
}

function SecurityItem({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof KeyRound
  title: string
  description: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <article className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center bg-accent text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-xs font-semibold">{title}</h4>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{description}</p>
      </div>
      {action}
    </article>
  )
}
