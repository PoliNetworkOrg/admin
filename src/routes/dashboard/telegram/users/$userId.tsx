import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  ExternalLink,
  History,
  LoaderCircle,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShieldX,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LiveStatus } from "@/components/live-status"
import { DetailPageSkeleton } from "@/components/loading-skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TgUserRole } from "@/lib/api/types"
import {
  addTelegramGroupAdmin,
  addTelegramUserRole,
  createTelegramGrant,
  getTelegramUserDetails,
  interruptTelegramGrant,
  removeTelegramUserRole,
} from "@/server/api.functions"

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

function groupLink(chatId: number, messageId: number, inviteLink?: string | null) {
  return inviteLink ?? messageLink(chatId, messageId)
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

  const { user, roles, configuredRoles, groupAdmin, groups, messages, audits, grant, grantStatus } = data
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
        <SummaryCard
          icon={ShieldCheck}
          label="ROLES"
          actions={
            <>
              <RoleDialog mode="add" userId={user.id} roles={roles} configuredRoles={configuredRoles} />
              <RoleDialog mode="remove" userId={user.id} roles={roles} configuredRoles={configuredRoles} />
            </>
          }
        >
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
        <SummaryCard
          icon={CalendarClock}
          label="ACCESS GRANT"
          actions={
            grant ? (
              <InterruptGrantDialog userId={user.id} displayName={displayName} status={grantStatus} />
            ) : (
              <CreateGrantDialog userId={user.id} displayName={displayName} />
            )
          }
        >
          {grant ? (
            <dl className="grid gap-2 text-xs">
              <Definition label="Status">
                <Badge variant={grantStatus === "scheduled" ? "secondary" : "default"}>
                  {grantStatus === "scheduled" ? "Scheduled" : "Active"}
                </Badge>
              </Definition>
              <Definition label="Valid from">{formatDate(grant.validSince)}</Definition>
              <Definition label="Valid until">{formatDate(grant.validUntil)}</Definition>
            </dl>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">No active or scheduled grant</span>
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
            <Card size="sm" key={`${message.chatId}-${message.messageId}`} className="gap-0 py-0">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/35 px-5 py-4">
                  <div className="min-w-0">
                    <a
                      className="group/link inline-flex max-w-full items-center gap-1.5 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
                      href={groupLink(message.chatId, message.messageId, message.group?.inviteLink)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="truncate">{message.group?.title ?? `Chat ${message.chatId}`}</span>
                      <ExternalLink className="size-3.5 shrink-0 opacity-65 transition-opacity group-hover/link:opacity-100" />
                    </a>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">Chat {message.chatId}</p>
                  </div>
                  <time className="shrink-0 text-right text-[10px] leading-4 text-muted-foreground">
                    {formatDate(message.timestamp)}
                  </time>
                </div>
                <div className="px-5 py-4">
                  <p className="border-l-2 border-primary/35 pl-3 text-[13px] leading-5 whitespace-pre-wrap">
                    {message.message}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[9px] text-muted-foreground">Message #{message.messageId}</span>
                    <a
                      className="flex items-center gap-1 rounded-sm font-mono text-[10px] font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
                      href={messageLink(message.chatId, message.messageId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open message <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
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
  actions,
  children,
}: {
  icon: typeof UserRound
  label: string
  actions?: React.ReactNode
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
      <CardContent className="flex grow flex-col px-5 pb-5 pt-0">
        <div className="grow">{children}</div>
        {actions && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>}
      </CardContent>
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

function roleLabel(role: TgUserRole) {
  return role
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

function RoleDialog({
  mode,
  userId,
  roles,
  configuredRoles,
}: {
  mode: "add" | "remove"
  userId: number
  roles: TgUserRole[]
  configuredRoles: TgUserRole[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<TgUserRole | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const adding = mode === "add"
  const choices = (adding ? configuredRoles.filter((role) => !roles.includes(role)) : roles).map((role) => ({
    value: role,
    label: roleLabel(role),
  }))
  const selectedChoice = choices.find((choice) => choice.value === selectedRole) ?? null
  const Icon = adding ? Plus : Minus

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) setSelectedRole(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedRole || pending) return
    setPending(true)

    try {
      const action = adding ? addTelegramUserRole : removeTelegramUserRole
      const result = await action({ data: { userId, role: selectedRole } })
      if (result.error) {
        toast.error(roleMutationError(result.error, adding))
        return
      }

      toast.success(`${roleLabel(selectedRole)} role ${adding ? "assigned" : "removed"}.`)
      setOpen(false)
      setSelectedRole(null)
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.error(`The role could not be ${adding ? "assigned" : "removed"}. Check your permissions and try again.`)
    } finally {
      setPending(false)
    }
  }

  const actionLabel = adding ? "Assign role" : "Remove role"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={adding ? "outline" : "destructive"}
            size="xs"
            disabled={!choices.length}
            aria-label={
              choices.length ? actionLabel : adding ? "All configured roles are assigned" : "No roles to remove"
            }
          />
        }
      >
        <Icon /> {actionLabel}
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">USER ROLES</p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">{actionLabel}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {adding
              ? "Choose one of the roles currently configured for Telegram users."
              : "Choose an assigned role to remove from this user."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={`${mode}-user-role`} className="font-mono text-[10px] text-muted-foreground">
              Role
            </FieldLabel>
            <Combobox
              items={choices}
              value={selectedChoice}
              onValueChange={(choice) => setSelectedRole(choice?.value ?? null)}
              itemToStringLabel={(choice) => choice.label}
              itemToStringValue={(choice) => choice.value}
            >
              <ComboboxInput
                id={`${mode}-user-role`}
                placeholder={adding ? "Search configured roles…" : "Search assigned roles…"}
                required
                className="h-10 text-xs"
              />
              <ComboboxContent>
                <ComboboxEmpty>{adding ? "No available roles" : "No assigned roles"}</ComboboxEmpty>
                <ComboboxList>
                  {(choice) => (
                    <ComboboxItem key={choice.value} value={choice} className="text-xs">
                      {choice.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={adding ? "default" : "destructive"}
              size="sm"
              disabled={!selectedRole || pending}
            >
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function roleMutationError(error: string, adding: boolean) {
  if (error === "UNAUTHORIZED_SELF_ASSIGN") return `You cannot ${adding ? "assign" : "remove"} this role on yourself.`
  if (error === "NOT_FOUND") return "That role is no longer assigned to this user."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage this role."
  return "The role update could not be completed."
}

function toDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function CreateGrantDialog({ userId, displayName }: { userId: number; displayName: string }) {
  const [open, setOpen] = useState(false)
  const [validSince, setValidSince] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const router = useRouter()

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      const since = new Date()
      since.setSeconds(0, 0)
      setValidSince(toDateTimeInput(since))
      setValidUntil(toDateTimeInput(new Date(since.getTime() + 24 * 60 * 60 * 1000)))
      setReason("")
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const since = new Date(validSince)
    const until = new Date(validUntil)
    if (
      !validSince ||
      !validUntil ||
      Number.isNaN(since.getTime()) ||
      Number.isNaN(until.getTime()) ||
      until <= since ||
      until <= new Date() ||
      pending
    )
      return
    setPending(true)

    try {
      const result = await createTelegramGrant({
        data: { userId, since, until, reason: reason.trim() || undefined },
      })
      if (result.error) {
        toast.error(grantMutationError(result.error))
        return
      }

      toast.success(`Access grant added for ${displayName}.`)
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.error("The access grant could not be added. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  const sinceTime = new Date(validSince).getTime()
  const untilTime = new Date(validUntil).getTime()
  const invalidEnd =
    Boolean(validUntil) &&
    (Number.isNaN(untilTime) || untilTime <= Date.now() || (Boolean(validSince) && untilTime <= sinceTime))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="xs" />}>
        <CalendarPlus /> Add grant
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">ACCESS GRANT</p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Add temporary access</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose when {displayName}&apos;s temporary access begins and ends. Active grants bypass automatic
            moderation.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 px-6 py-5" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor="grant-valid-since" className="font-mono text-[10px] text-muted-foreground">
              Valid from
            </FieldLabel>
            <Input
              id="grant-valid-since"
              type="datetime-local"
              value={validSince}
              onChange={(event) => setValidSince(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="grant-valid-until" className="font-mono text-[10px] text-muted-foreground">
              Valid until
            </FieldLabel>
            <Input
              id="grant-valid-until"
              type="datetime-local"
              min={validSince || toDateTimeInput(new Date())}
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              aria-invalid={invalidEnd}
              required
            />
            {invalidEnd && <p className="text-[10px] text-destructive">Choose a time in the future.</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="grant-reason" className="font-mono text-[10px] text-muted-foreground">
              Reason <span className="font-sans normal-case">(optional)</span>
            </FieldLabel>
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this access needed?"
              maxLength={500}
            />
          </Field>
          <DialogFooter className="-mx-6 -mb-5 mt-1 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!validSince || !validUntil || invalidEnd || pending}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              Add grant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InterruptGrantDialog({
  userId,
  displayName,
  status,
}: {
  userId: number
  displayName: string
  status: "active" | "scheduled" | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function interrupt() {
    if (pending) return
    setPending(true)
    try {
      const result = await interruptTelegramGrant({ data: { userId } })
      if (result.error) {
        toast.error(grantMutationError(result.error))
        return
      }

      toast.success(`Access grant removed from ${displayName}.`)
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.error("The access grant could not be removed. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="xs" />}>
        <ShieldX /> Remove grant
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <ShieldX />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove access grant?</AlertDialogTitle>
          <AlertDialogDescription>
            {status === "scheduled"
              ? `${displayName}'s scheduled access will be cancelled before it begins.`
              : `${displayName} will immediately return to the normal automatic moderation rules.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void interrupt()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Remove grant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function grantMutationError(error: string) {
  if (error === "ALREADY_EXISTING") return "This user already has an active access grant."
  if (error === "NOT_FOUND") return "This grant has already expired or been removed."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage access grants."
  return "The access grant update could not be completed."
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
            <Combobox
              items={availableGroups}
              value={availableGroups.find((group) => String(group.telegramId) === groupId) ?? null}
              onValueChange={(group) => setGroupId(group ? String(group.telegramId) : "")}
              itemToStringLabel={(group) => group.title}
              itemToStringValue={(group) => String(group.telegramId)}
              disabled={!availableGroups.length}
            >
              <ComboboxInput id="admin-group" placeholder="Search groups…" required className="h-10 text-xs" />
              <ComboboxContent>
                <ComboboxEmpty>No matching groups</ComboboxEmpty>
                <ComboboxList>
                  {(group) => (
                    <ComboboxItem key={group.telegramId} value={group} className="text-xs">
                      <span>{group.title}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
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
