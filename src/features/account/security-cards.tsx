import { KeyRound, MonitorSmartphone, Plus, Trash2 } from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  IconButton,
  InlineAlert,
  LoadingButton,
  SectionCard,
  SectionEmpty,
  SettingsListSkeleton,
  StatusBadge,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDate, pluralize } from "@/lib/format"

import type { ActiveSession, Passkey } from "./types"
import type { SecurityState } from "./use-account"

function ListRow({ icon, title, meta, end }: { icon: ReactNode; title: ReactNode; meta: ReactNode; end?: ReactNode }) {
  return (
    <li className="flex h-14 items-center gap-3 border-b border-(--pn-line) last:border-0">
      <span className="flex shrink-0 text-(--pn-fg-muted)">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-5 font-medium text-(--pn-fg)">{title}</span>
        <span className="truncate text-xs leading-4 whitespace-nowrap text-(--pn-fg-muted) tabular-nums">{meta}</span>
      </div>
      {end && <div className="flex shrink-0 items-center gap-2">{end}</div>}
    </li>
  )
}

/** Shown once, in the Passkeys card; its Retry reloads passkeys and sessions together. */
function SecurityError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <div className="py-4">
      <InlineAlert
        action={
          <LoadingButton variant="outline" pending={retrying} onClick={onRetry}>
            Retry
          </LoadingButton>
        }
      >
        Couldn't load passkeys and sessions.
      </InlineAlert>
    </div>
  )
}

function toDate(value: Date | string | undefined) {
  if (value === undefined) return null
  return value instanceof Date ? value : new Date(value)
}

const deviceTypeLabels = new Map([
  ["multiDevice", "synced"],
  ["singleDevice", "device-bound"],
])

function passkeyMeta(passkey: Passkey) {
  const created = toDate(passkey.createdAt)
  const added = created ? `Added ${formatDate(created)}` : "Added recently"
  const device = passkey.deviceType ? (deviceTypeLabels.get(passkey.deviceType) ?? passkey.deviceType) : null
  return device ? `${added} · ${device}` : added
}

function passkeyName(passkey: Passkey) {
  return passkey.name || "Unnamed passkey"
}

type PasskeysCardProps = {
  state: SecurityState
  retrying: boolean
  onRetry: () => void
  passkeys: Passkey[]
  onAdd: () => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function PasskeysCard({ state, retrying, onRetry, passkeys, onAdd, onDelete }: PasskeysCardProps) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Passkey | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const focus = useFocusAfterRemoval<HTMLDivElement>("li")

  async function addPasskey() {
    setAdding(true)
    try {
      await onAdd()
      appToast.success("Passkey added.")
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't add the passkey.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <SectionCard
      title="Passkeys"
      padding="flush"
      action={
        <LoadingButton icon={Plus} pending={adding} onClick={() => void addPasskey()}>
          Add passkey
        </LoadingButton>
      }
    >
      <div ref={focus.surfaceRef} tabIndex={-1} className="px-5">
        {state === "loading" && <SettingsListSkeleton rows={2} label="Loading passkeys…" />}
        {state === "error" && <SecurityError retrying={retrying} onRetry={onRetry} />}
        {state === "ready" &&
          (passkeys.length === 0 ? (
            <SectionEmpty title="No passkeys yet" hint="Add one to sign in without a code." className="px-0" />
          ) : (
            <ul aria-label="Passkeys">
              {passkeys.map((passkey) => (
                <ListRow
                  key={passkey.id}
                  icon={<KeyRound aria-hidden className="size-4" />}
                  title={passkeyName(passkey)}
                  meta={passkeyMeta(passkey)}
                  end={
                    <IconButton
                      label="Delete passkey"
                      ariaLabel={`Delete ${passkeyName(passkey)}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={(event) => {
                        focus.capture(event.currentTarget)
                        setDeleting(passkey)
                        setConfirmOpen(true)
                      }}
                    />
                  }
                />
              ))}
            </ul>
          ))}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete passkey?"
        finalFocus={focus.target}
        description={`${deleting ? passkeyName(deleting) : "This passkey"} will no longer sign in to this account.`}
        confirmLabel="Delete passkey"
        onConfirm={async () => {
          if (!deleting) return
          await onDelete(deleting.id)
          appToast.success("Passkey deleted.")
        }}
      />
    </SectionCard>
  )
}

function sessionMeta(session: ActiveSession) {
  const since = toDate(session.createdAt)
  const ip = session.ipAddress ? <span className="font-mono">{session.ipAddress}</span> : "Unknown IP"
  return (
    <>
      {ip}
      {since && ` · Since ${formatDate(since)}`}
    </>
  )
}

type SessionsCardProps = {
  state: SecurityState
  /** The current session first. */
  sessions: ActiveSession[]
  currentSessionId: string
  onRevokeOthers: () => Promise<void>
}

export function SessionsCard({ state, sessions, currentSessionId, onRevokeOthers }: SessionsCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const others = sessions.filter((session) => session.id !== currentSessionId).length

  return (
    <SectionCard
      title="Sessions"
      padding="flush"
      action={
        state === "ready" && others === 0 ? (
          // Keeps the header as tall as it is with the button.
          <span aria-hidden className="h-9" />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={state !== "ready"}
            className={buttonMotion}
            onClick={() => setConfirmOpen(true)}
          >
            Sign out other sessions
          </Button>
        )
      }
    >
      <div className="px-5">
        {state === "loading" && <SettingsListSkeleton rows={2} label="Loading sessions…" />}
        {state === "error" && (
          <p className="flex h-14 items-center text-[13px] text-(--pn-fg-muted)">Couldn't load sessions.</p>
        )}
        {state === "ready" && (
          <ul aria-label="Sessions">
            {sessions.map((session) => (
              <ListRow
                key={session.id}
                icon={<MonitorSmartphone aria-hidden className="size-4" />}
                title={session.userAgent || "Unknown device"}
                meta={sessionMeta(session)}
                end={session.id === currentSessionId ? <StatusBadge tone="brand">Current</StatusBadge> : undefined}
              />
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out other sessions?"
        description={`${pluralize(others, "other session")} will be signed out. This device stays signed in.`}
        confirmLabel="Sign out sessions"
        onConfirm={async () => {
          await onRevokeOthers()
          appToast.success("Other sessions signed out.")
        }}
      />
    </SectionCard>
  )
}
