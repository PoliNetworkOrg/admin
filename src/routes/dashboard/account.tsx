import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  Calendar,
  Camera,
  KeyRound,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { auth, useSession } from "@/lib/auth"
import type { AdminSession } from "@/server/api.functions"
import { getCurrentTelegramRoles, uploadProfilePicture } from "@/server/api.functions"

type Passkey = { id: string; name?: string | null; createdAt?: Date | string; deviceType?: string }
type ActiveSession = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt?: Date | string
}

export const Route = createFileRoute("/dashboard/account")({
  loader: () => getCurrentTelegramRoles(),
  component: Account,
})

function avatarText(name?: string | null, email?: string) {
  return (name || email || "U")
    .split(/[\s.@_-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function Account() {
  const router = useRouter()
  const rolesResponse = Route.useLoaderData()
  const initial = Route.useRouteContext().session as AdminSession
  const sessionQuery = useSession()
  const session = (sessionQuery.data as AdminSession | null) ?? initial
  const user = session.user
  const telegramRoles = rolesResponse.data ?? []
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [securityLoading, setSecurityLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const sortedSessions = useMemo(() => sessions.toSorted((a) => (a.id === session.session.id ? -1 : 0)), [sessions])

  const refreshSecurityData = useCallback(async () => {
    try {
      const [passkeyResult, sessionResult] = await Promise.all([auth.passkey.listUserPasskeys(), auth.listSessions()])
      setPasskeys((passkeyResult.data ?? []) as Passkey[])
      setSessions((sessionResult.data ?? []) as ActiveSession[])
    } catch {
      setNotice({ type: "error", text: "Could not load passkeys and active sessions." })
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
        await refreshSecurityData()
        setNotice({ type: "success", text: "Passkey created." })
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
        await refreshSecurityData()
        setNotice({ type: "success", text: "Passkey deleted." })
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
        await refreshSecurityData()
        setNotice({ type: "success", text: "Other sessions signed out." })
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

  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Account"
        title="Profile and security"
        description="Manage your identity, passkeys and active sessions."
      />
      {notice && (
        <Alert variant={notice.type === "error" ? "destructive" : "default"} className="mt-4">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      <div className="mt-5 grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <Card className="col-span-2 max-[900px]:grid-cols-1">
          <CardHeader className="flex flex-row items-center gap-4 max-[600px]:flex-wrap">
            <div className="relative">
              <Avatar className="size-20 after:border-0">
                {user?.image && <AvatarImage src={user.image} alt="Your profile" />}
                <AvatarFallback className="bg-primary font-mono text-base text-primary-foreground">
                  {avatarText(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="secondary"
                size="icon-sm"
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
                className="text-[10px] text-destructive"
                onClick={() => void removeImage()}
                disabled={busy === "image"}
              >
                Remove picture
              </Button>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 border-b border-border">
            <UserRound className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <CardTitle>Profile details</CardTitle>
              <CardDescription className="mt-1">Displayed throughout the admin console.</CardDescription>
            </span>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void updateName(event)}>
              <FieldGroup className="gap-3.5">
                <Field>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input
                    id="full-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-email">Email address</FieldLabel>
                  <Input id="account-email" value={user?.email ?? ""} disabled />
                </Field>
                <Button type="submit" className="w-max" disabled={busy === "name" || name.trim() === user?.name}>
                  {busy === "name" && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Save
                  profile
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 border-b border-border">
            <ShieldCheck className="mt-0.5 shrink-0 text-primary" />
            <span>
              <CardTitle>Telegram identity</CardTitle>
              <CardDescription className="mt-1">Used to determine roles and permissions.</CardDescription>
            </span>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <dl className="grid gap-3">
              <div>
                <dt className="font-mono text-[10px] text-muted-foreground">Username</dt>
                <dd className="mt-1">{user?.telegramUsername ? `@${user.telegramUsername}` : "Not available"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] text-muted-foreground">Telegram ID</dt>
                <dd className="mt-1 font-mono text-[10px]">{user?.telegramId ?? "Not linked"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] text-muted-foreground">Roles</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {telegramRoles.length ? (
                    telegramRoles.map((role) => (
                      <Badge key={role} variant="secondary" className="font-mono text-[9px] text-primary">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground">
                      {rolesResponse.connected ? "No assigned roles" : "Roles unavailable"}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="col-span-2 max-[900px]:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <CardTitle>Passkeys</CardTitle>
                <CardDescription className="mt-1">Phishing-resistant access from your trusted devices.</CardDescription>
              </span>
            </div>
            <Button onClick={() => void addPasskey()} disabled={busy === "passkey"}>
              <KeyRound data-icon="inline-start" /> Add passkey
            </Button>
          </CardHeader>
          <CardContent>
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
                        className="text-destructive"
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

        <Card className="col-span-2 max-[900px]:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <CardTitle>Active sessions</CardTitle>
                <CardDescription className="mt-1">Devices currently signed in to your account.</CardDescription>
              </span>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void revokeOtherSessions()}
                disabled={busy === "sessions"}
              >
                Sign out other sessions
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {securityLoading ? (
              <SecurityLoading rows={2} />
            ) : (
              <SecurityList>
                {sortedSessions.map((activeSession) => (
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
                        <Badge className="h-5 px-1.5 font-mono text-[9px]">Current</Badge>
                      ) : undefined
                    }
                  />
                ))}
              </SecurityList>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="destructive"
              size="sm"
              className="text-destructive"
              onClick={() => void logout()}
              disabled={busy === "logout"}
            >
              <LogOut data-icon="inline-start" /> Sign out of this device
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function SecurityList({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5">{children}</div>
}

function SecurityLoading({ rows }: { rows: number }) {
  return (
    <div className="grid" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0">
          <Skeleton className="size-7" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-2.5 w-56 max-w-full" />
          </div>
          <Skeleton className="size-7" />
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
    <article className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-xs font-semibold">{title}</h4>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </article>
  )
}
