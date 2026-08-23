import { Calendar, KeyRound, LogOut, MonitorSmartphone, Shield, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { ConfirmationDialog } from "./confirmation-dialog"
import type { ActiveSession, Passkey } from "./types"

export function PasskeysCard({
  passkeys,
  busy,
  loading,
  onAdd,
  onDelete,
}: {
  passkeys: Passkey[]
  busy: string | null
  loading: boolean
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="col-span-2 max-[900px]:col-span-1">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <CardTitle>Passkeys</CardTitle>
            <CardDescription className="mt-1">Phishing-resistant access from your trusted devices.</CardDescription>
          </span>
        </div>
        <Button onClick={onAdd} disabled={busy === "passkey" || loading}>
          <KeyRound data-icon="inline-start" /> Add passkey
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
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
                  <ConfirmationDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        disabled={busy === passkey.id}
                        aria-label="Delete passkey"
                      >
                        <Trash2 />
                      </Button>
                    }
                    title="Delete passkey?"
                    description={`The passkey ${passkey.name || "Unnamed passkey"} will no longer sign in to this account.`}
                    actionLabel="Delete passkey"
                    onConfirm={() => onDelete(passkey.id)}
                  />
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
  )
}

export function SessionsCard({
  sessions,
  currentSessionId,
  busy,
  loading,
  onRevokeOthers,
  onLogout,
}: {
  sessions: ActiveSession[]
  currentSessionId: string
  busy: string | null
  loading: boolean
  onRevokeOthers: () => void
  onLogout: () => void
}) {
  return (
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
          <ConfirmationDialog
            trigger={
              <Button variant="outline" size="sm" disabled={busy === "sessions"}>
                Sign out other sessions
              </Button>
            }
            title="Sign out other sessions?"
            description={`This will sign out ${sessions.length - 1} other active ${sessions.length === 2 ? "session" : "sessions"}. Your current session will stay signed in.`}
            actionLabel="Sign out sessions"
            onConfirm={onRevokeOthers}
          />
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
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
                  activeSession.id === currentSessionId ? (
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
          onClick={onLogout}
          disabled={busy === "logout"}
        >
          <LogOut data-icon="inline-start" /> Sign out of this device
        </Button>
      </CardFooter>
    </Card>
  )
}

function SecurityList({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5">{children}</div>
}

function SecurityLoading({ rows }: { rows: number }) {
  return (
    <div className="grid" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading security information</span>
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
