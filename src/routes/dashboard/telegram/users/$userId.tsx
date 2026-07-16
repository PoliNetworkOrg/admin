import { Combobox } from "@base-ui/react/combobox"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  History,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import { LiveStatus } from "@/components/live-status"
import { DetailPageSkeleton } from "@/components/loading-skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { addTelegramGroupAdmin, getTelegramUserDetails } from "@/server/api.functions"

export const Route = createFileRoute("/dashboard/telegram/users/$userId")({
  loader: ({ params }) => {
    const userId = Number(params.userId)
    if (!Number.isInteger(userId) || userId <= 0) return { data: null, connected: true }
    return getTelegramUserDetails({ data: { userId } })
  },
  pendingComponent: DetailPageSkeleton,
  component: UserProfile,
})

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function messageLink(chatId: number, messageId: number) {
  return `https://t.me/c/${String(chatId).replace("-100", "")}/${messageId}`
}

function UserProfile() {
  const response = Route.useLoaderData()
  const { userId } = Route.useParams()
  const router = useRouter()
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const data = Array.isArray(response.data) ? null : response.data

  if (!data) {
    return (
      <div className="animate-appear">
        <BackLink />
        <LiveStatus connected={response.connected} message={"message" in response ? response.message : undefined} />
        <Card className="mt-5 border-dashed text-center">
          <CardContent className="px-5 py-10">
            <UserRound className="mx-auto size-6 text-primary" />
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">User not found</h2>
            <p className="mt-2 text-xs text-muted-foreground">No Telegram user exists with ID {userId}.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user, roles, groupAdmin, groups, messages, audits, grant } = data
  const administeredGroups = groupAdmin.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"

  return (
    <div className="animate-appear">
      <BackLink />
      <LiveStatus connected={response.connected} message={"message" in response ? response.message : undefined} />
      <Card className="mt-5 [--card-spacing:--spacing(5)]">
        <CardHeader className="flex flex-row items-center gap-4 max-[600px]:flex-wrap">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary font-mono text-base font-semibold text-primary-foreground">
              {(user.firstName?.[0] ?? user.username?.[0] ?? String(user.id).slice(-2)).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-primary uppercase">
              Telegram profile · {user.id}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.username ? `@${user.username}` : "No Telegram username"}
            </p>
          </div>
          <Badge variant="secondary">
            {roles.length} role{roles.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
      </Card>

      <section className="mt-[18px] grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        <SummaryCard icon={UserRound} label="IDENTITY">
          <dl className="grid gap-2 text-xs">
            <Definition label="Telegram ID">
              <span className="font-mono text-[10px]">{user.id}</span>
            </Definition>
            <Definition label="Name">{displayName}</Definition>
            <Definition label="Username">{user.username ? `@${user.username}` : "—"}</Definition>
          </dl>
        </SummaryCard>
        <SummaryCard icon={ShieldCheck} label="ROLES">
          <div className="flex flex-wrap gap-1.5">
            {roles.length ? (
              roles.map((role) => (
                <Badge key={role} className="h-5 bg-accent px-1.5 font-mono text-[9px] text-primary">
                  {role}
                </Badge>
              ))
            ) : (
              <span className="text-[11px] italic text-muted-foreground">No assigned roles</span>
            )}
          </div>
        </SummaryCard>
        <SummaryCard icon={CalendarClock} label="ACCESS GRANT">
          {grant ? (
            <dl className="grid gap-2 text-xs">
              <Definition label="Valid from">{formatDate(grant.validSince)}</Definition>
              <Definition label="Valid until">{formatDate(grant.validUntil)}</Definition>
            </dl>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">No ongoing grant</span>
          )}
        </SummaryCard>
      </section>

      <DetailSection
        icon={UsersRound}
        title="Group administration"
        count={administeredGroups.length}
        action={
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => setAdminDialogOpen(true)}>
            <UserPlus data-icon="inline-start" /> Add group
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {administeredGroups.map((entry) => (
            <Card size="sm" key={entry.group.id}>
              <CardContent className="p-5">
                <h3 className="text-[13px]">{entry.group.title}</h3>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{entry.group.id}</p>
                <small className="mt-3 block text-[10px] text-muted-foreground">
                  Added by {entry.addedBy.firstName}
                  {entry.addedBy.username ? ` · @${entry.addedBy.username}` : ""}
                </small>
              </CardContent>
            </Card>
          ))}
          {!administeredGroups.length && <SectionEmpty text="This user does not administer any group." />}
        </div>
      </DetailSection>
      <AddGroupAdminDialog
        open={adminDialogOpen}
        userId={user.id}
        groups={groups}
        administeredGroupIds={new Set(administeredGroups.map((entry) => entry.group.id))}
        onClose={() => setAdminDialogOpen(false)}
        onSaved={async () => {
          setAdminDialogOpen(false)
          await router.invalidate({ sync: true })
        }}
      />
      <DetailSection icon={MessageCircle} title="Recent messages" count={messages.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {messages.map((message) => (
            <Card size="sm" key={`${message.chatId}-${message.messageId}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13px]">{message.group?.title ?? `Chat ${message.chatId}`}</h3>
                  <time className="shrink-0 text-[10px] text-muted-foreground">{formatDate(message.timestamp)}</time>
                </div>
                <p className="mt-3 text-xs leading-[1.5]">{message.message}</p>
                <a
                  className="mt-3 flex items-center gap-1 font-mono text-[10px] font-medium text-primary hover:underline"
                  href={messageLink(message.chatId, message.messageId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open message <ExternalLink className="size-4" />
                </a>
              </CardContent>
            </Card>
          ))}
          {!messages.length && <SectionEmpty text="No recent messages from this user." />}
        </div>
      </DetailSection>
      <DetailSection icon={History} title="Audit log" count={audits.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {audits.map((audit) => (
            <Card size="sm" key={`${audit.id}-${audit.type}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13px]">{audit.type}</h3>
                  <time className="shrink-0 text-[10px] text-muted-foreground">{formatDate(audit.createdAt)}</time>
                </div>
                <p className="mt-3 text-xs leading-[1.5]">{audit.reason ?? "No reason provided"}</p>
                {audit.groupTitle && (
                  <small className="mt-2 block text-[10px] text-muted-foreground">
                    {audit.groupTitle} · {audit.groupId}
                  </small>
                )}
              </CardContent>
            </Card>
          ))}
          {!audits.length && <SectionEmpty text="No audit events found for this user." />}
        </div>
      </DetailSection>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/dashboard/telegram/users"
      className="flex w-max items-center gap-1.5 font-mono text-[11px] text-primary hover:underline"
    >
      <ArrowLeft className="size-4" /> Back to users
    </Link>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound
  label: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-3 p-5 pb-3">
        <Icon className="size-5 text-primary" />
        <CardTitle className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">{children}</CardContent>
    </Card>
  )
}

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
function SectionEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center text-xs text-muted-foreground">
      {text}
    </p>
  )
}

function DetailSection({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: typeof UserRound
  title: string
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-[34px]">
      <header className="mb-4 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>
        </span>
        <span className="flex items-center gap-3">
          {action}
          <b className="font-mono text-[10px] text-muted-foreground">{count}</b>
        </span>
      </header>
      {children}
    </section>
  )
}

function AddGroupAdminDialog({
  open,
  userId,
  groups,
  administeredGroupIds,
  onClose,
  onSaved,
}: {
  open: boolean
  userId: number
  groups: Array<{ telegramId: number; title: string }>
  administeredGroupIds: Set<number>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [groupId, setGroupId] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const availableGroups = groups.filter((group) => !administeredGroupIds.has(group.telegramId))

  useEffect(() => {
    if (open) {
      setGroupId("")
      setError("")
    }
  }, [open])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!groupId) return
    setPending(true)
    setError("")
    try {
      await addTelegramGroupAdmin({ data: { userId, groupId: Number(groupId) } })
      await onSaved()
    } catch {
      setError("The user could not be added as a group administrator.")
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
            GROUP ADMINISTRATION
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Add group administrator</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose a group this user should administer.
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor="admin-group" className="font-mono text-[10px] font-medium text-muted-foreground">
              Group
            </FieldLabel>
            <Combobox.Root
              items={availableGroups}
              value={availableGroups.find((group) => String(group.telegramId) === groupId) ?? null}
              onValueChange={(group) => setGroupId(group ? String(group.telegramId) : "")}
              itemToStringLabel={(group) => group.title}
              itemToStringValue={(group) => String(group.telegramId)}
              disabled={!availableGroups.length}
            >
              <Combobox.InputGroup className="flex h-10 w-full rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/20">
                <Combobox.Input
                  id="admin-group"
                  placeholder="Search groups…"
                  className="min-w-0 flex-1 bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground"
                  required
                />
                <Combobox.Trigger className="grid w-9 place-items-center text-muted-foreground hover:text-primary">
                  <ChevronDown className="size-4" />
                </Combobox.Trigger>
              </Combobox.InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup className="max-h-60 min-w-[var(--anchor-width)] overflow-auto rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
                    <Combobox.Empty className="px-3 py-2 text-muted-foreground">No matching groups</Combobox.Empty>
                    <Combobox.List>
                      {(group) => (
                        <Combobox.Item
                          key={group.telegramId}
                          value={group}
                          className="flex cursor-default items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-accent data-highlighted:text-primary"
                        >
                          <Combobox.ItemIndicator>
                            <Check className="size-3.5" />
                          </Combobox.ItemIndicator>
                          <span>{group.title}</span>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field>
          {!availableGroups.length && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              This user already administers every available group.
            </p>
          )}
          {error && <p className="mt-3 text-[10px] text-destructive">{error}</p>}
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" className="text-[11px]" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="text-[11px]" disabled={pending || !availableGroups.length}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              Add administrator
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
