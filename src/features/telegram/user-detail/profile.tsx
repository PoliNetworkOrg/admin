import { Link } from "@tanstack/react-router"
import { CalendarPlus, ExternalLink, Minus, Plus, ShieldX, UserX } from "lucide-react"
import { type ReactNode, useMemo, useRef, useState } from "react"

import {
  buttonMotion,
  buttonTones,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Hint,
  initialsOf,
  RecordHeader,
  SectionCard,
  SectionEmpty,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { PageBar, PageContent, useCanWrite } from "@/components/shell"
import { CreateGrantDialog } from "@/components/telegram/create-grant-dialog"
import { telegramUserName } from "@/components/telegram/telegram-user"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { TgGrant } from "@/lib/api/types"
import { formatDateTime, formatRange } from "@/lib/format"
import { cn } from "@/lib/utils"

import { InterruptGrantDialog } from "./grant-dialogs"
import { AddGroupAdminDialog, RemoveGroupAdminDialog } from "./group-admin-dialog"
import { RoleDialog, type RoleDialogMode } from "./role-dialog"
import type { TelegramUserDetail } from "./types"

const BACK = { label: "users", link: { to: "/dashboard/telegram/users" } } as const

type Message = TelegramUserDetail["messages"][number]
type Audit = TelegramUserDetail["audits"][number]

export function TelegramUserNotFound({ userId }: { userId: string }) {
  return (
    <>
      <PageBar back={BACK} context={userId} contextMono />
      <PageContent width="record">
        <h1 className="sr-only">User not found</h1>
        <EmptyState
          icon={UserX}
          title="User not found"
          text="No Telegram user has this ID. They may never have interacted with the bot."
          action={
            <Button
              size="sm"
              variant="outline"
              className={buttonMotion}
              nativeButton={false}
              render={<Link to="/dashboard/telegram/users" />}
            >
              Back to users
            </Button>
          }
        />
      </PageContent>
    </>
  )
}

type OpenDialog = "none" | "grant" | "end-grant" | "role" | "add-group" | "remove-group"

/** Telegram user detail (docs/design.md §7.4): roles in the header, then grants, groups, messages, audit log. */
export function TelegramUserDetailPage({ data }: { data: TelegramUserDetail }) {
  const { user, roles, configuredRoles, groupAdmin, groups, messages, audits, ongoingGrant, scheduledGrants } = data
  const canWrite = useCanWrite()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [dialog, setDialog] = useState<OpenDialog>("none")
  // Dialog subjects outlive `dialog` so each dialog keeps its copy while it animates closed.
  const [roleMode, setRoleMode] = useState<RoleDialogMode>("add")
  const [removeTarget, setRemoveTarget] = useState<{ groupId: number; groupTitle: string } | null>(null)
  const name = telegramUserName(user)
  const assignable = configuredRoles.filter((role) => !roles.includes(role))
  const administeredGroupIds = useMemo(() => new Set(groupAdmin.map((entry) => entry.group.id)), [groupAdmin])

  function closeDialog(open: boolean) {
    if (!open) setDialog("none")
  }

  const headerActions = canWrite ? (
    <>
      {ongoingGrant && (
        <Button
          variant="outline"
          size="sm"
          className={cn(buttonMotion, buttonTones.dangerOutline)}
          onClick={() => setDialog("end-grant")}
        >
          <ShieldX aria-hidden data-icon="inline-start" />
          End grant
        </Button>
      )}
      <Button size="sm" className={buttonMotion} onClick={() => setDialog("grant")}>
        <CalendarPlus aria-hidden data-icon="inline-start" />
        Add grant
      </Button>
    </>
  ) : undefined

  return (
    <>
      <PageBar
        back={BACK}
        context={String(user.id)}
        contextMono
        scrollTitleRef={titleRef}
        scrollTitle={name}
        right={headerActions}
      />
      <PageContent width="record">
        <div className="flex flex-col gap-6">
          <RecordHeader
            titleRef={titleRef}
            title={name}
            className="border-b border-(--pn-line) pb-6"
            avatar={
              <Avatar size="lg">
                <AvatarFallback className="bg-(--pn-accent-solid) text-sm font-medium text-(--pn-accent-solid-fg)">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
            }
            meta={user.username ? `@${user.username}` : <Unset />}
            chips={
              roles.length > 0 || canWrite ? (
                <>
                  {roles.map((role) => (
                    <Chip key={role}>{role}</Chip>
                  ))}
                  {canWrite && (
                    <>
                      <RoleButton
                        icon={<Plus aria-hidden data-icon="inline-start" />}
                        label="Assign role"
                        disabledReason={assignable.length === 0 ? "All configured roles are assigned" : null}
                        onClick={() => {
                          setRoleMode("add")
                          setDialog("role")
                        }}
                      />
                      <RoleButton
                        icon={<Minus aria-hidden data-icon="inline-start" />}
                        label="Remove role"
                        disabledReason={roles.length === 0 ? "No roles to remove" : null}
                        onClick={() => {
                          setRoleMode("remove")
                          setDialog("role")
                        }}
                      />
                    </>
                  )}
                </>
              ) : undefined
            }
          />

          <GrantsSection ongoing={ongoingGrant} scheduled={scheduledGrants} />

          <SectionCard
            title="Group administration"
            count={groupAdmin.length}
            padding="flush"
            action={
              canWrite ? (
                <Button variant="outline" size="sm" className={buttonMotion} onClick={() => setDialog("add-group")}>
                  <Plus aria-hidden data-icon="inline-start" />
                  Add group
                </Button>
              ) : undefined
            }
          >
            {groupAdmin.length === 0 ? (
              <SectionEmpty title="No administered groups" hint="Groups this user administers appear here." />
            ) : (
              <ul className="divide-y divide-(--pn-line)">
                {groupAdmin.map((entry) => (
                  <li
                    key={entry.group.id}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-2 sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,220px)_auto]"
                  >
                    <Link
                      to="/dashboard/telegram/groups"
                      search={{ q: entry.group.title }}
                      title={entry.group.title}
                      className="truncate text-[13px] font-medium text-(--pn-fg) underline-offset-2 hover:text-(--pn-accent) hover:underline"
                    >
                      {entry.group.title}
                    </Link>
                    <span className="font-mono text-xs text-(--pn-fg-muted) tabular-nums max-sm:hidden">
                      {entry.group.id}
                    </span>
                    <span className="truncate text-xs text-(--pn-fg-muted) max-sm:hidden">
                      Added by {entry.addedBy.firstName}
                      {entry.addedBy.username ? ` · @${entry.addedBy.username}` : ""}
                    </span>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(buttonMotion, buttonTones.dangerGhost, "-mr-2")}
                        aria-label={`Remove ${name} as administrator of ${entry.group.title}`}
                        onClick={() => {
                          setRemoveTarget({ groupId: entry.group.id, groupTitle: entry.group.title })
                          setDialog("remove-group")
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent messages" count={messages.length} padding="flush">
            {messages.length === 0 ? (
              <SectionEmpty title="No recent messages from this user" />
            ) : (
              <ul className="divide-y divide-(--pn-line)">
                {messages.map((message) => (
                  <MessageRow key={`${message.chatId}-${message.messageId}`} message={message} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Audit log" count={audits.length} padding="flush">
            {audits.length === 0 ? (
              <SectionEmpty title="No audit events for this user" />
            ) : (
              <DataTable
                label={`Audit log for ${name}`}
                columns={auditColumns}
                rows={audits}
                getRowId={(audit) => `${audit.id}-${audit.type}`}
                className="rounded-none border-0"
                empty={null}
              />
            )}
          </SectionCard>
        </div>
      </PageContent>

      {canWrite && (
        <>
          <CreateGrantDialog open={dialog === "grant"} onOpenChange={closeDialog} user={user} />
          <InterruptGrantDialog
            open={dialog === "end-grant"}
            onOpenChange={closeDialog}
            userId={user.id}
            userName={name}
          />
          <RoleDialog
            open={dialog === "role"}
            onOpenChange={closeDialog}
            mode={roleMode}
            userId={user.id}
            roles={roles}
            configuredRoles={configuredRoles}
          />
          <AddGroupAdminDialog
            open={dialog === "add-group"}
            onOpenChange={closeDialog}
            userId={user.id}
            groups={groups}
            administeredGroupIds={administeredGroupIds}
          />
          {removeTarget && (
            <RemoveGroupAdminDialog
              open={dialog === "remove-group"}
              onOpenChange={closeDialog}
              userId={user.id}
              userName={name}
              groupId={removeTarget.groupId}
              groupTitle={removeTarget.groupTitle}
            />
          )}
        </>
      )}
    </>
  )
}

type RoleButtonProps = {
  icon: ReactNode
  label: string
  /** Disables the button and explains why in its tooltip. */
  disabledReason: string | null
  onClick: () => void
}

function RoleButton({ icon, label, disabledReason, onClick }: RoleButtonProps) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabledReason !== null}
      onClick={onClick}
      className={cn(buttonMotion, "text-(--pn-fg-muted) hover:text-(--pn-fg)")}
    >
      {icon}
      {label}
    </Button>
  )
  if (!disabledReason) return button
  // Disabled buttons swallow pointer events, so the tooltip hangs off a focusable wrapper.
  return (
    <Hint label={disabledReason}>
      <span tabIndex={0} aria-label={disabledReason} className="inline-flex rounded-(--pn-r-3)">
        {button}
      </span>
    </Hint>
  )
}

type GrantWindow = Pick<TgGrant, "validSince" | "validUntil">

function GrantsSection({ ongoing, scheduled }: { ongoing: GrantWindow | null; scheduled: GrantWindow[] }) {
  const rows = [
    ...(ongoing ? [{ grant: ongoing, label: "Ongoing", status: "active" as const }] : []),
    ...scheduled.map((grant) => ({ grant, label: "Scheduled", status: "scheduled" as const })),
  ]
  return (
    <SectionCard title="Grants" padding="flush">
      {rows.length === 0 ? (
        <SectionEmpty
          title="No active or scheduled grants"
          hint="Grants let this user send links without automatic moderation."
        />
      ) : (
        <ul className="divide-y divide-(--pn-line)">
          {rows.map(({ grant, label, status }) => (
            // `tg.grants.checkUser` returns the ongoing grant without an id; no two grants of a user share a start.
            <li
              key={`${label}-${grant.validSince.getTime()}`}
              className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2"
            >
              <span className="w-20 text-[13px] font-medium text-(--pn-fg-muted)">{label}</span>
              {status === "active" ? (
                <StatusBadge tone="success">Active</StatusBadge>
              ) : (
                <StatusBadge tone="brand">Scheduled</StatusBadge>
              )}
              <span className="text-[13px] whitespace-nowrap text-(--pn-fg) tabular-nums">
                {formatRange(grant.validSince, grant.validUntil)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function messageLink(chatId: number, messageId: number) {
  return `https://t.me/c/${String(chatId).replace("-100", "")}/${messageId}`
}

const externalLink =
  "inline-flex min-w-0 items-center gap-1 text-(--pn-accent) underline-offset-2 transition-[color] duration-120 hover:text-(--pn-accent-hover) hover:underline"

function MessageRow({ message }: { message: Message }) {
  const link = messageLink(message.chatId, message.messageId)
  return (
    <li className="flex flex-col gap-2 px-5 py-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <a
          href={message.group?.inviteLink ?? link}
          target="_blank"
          rel="noreferrer"
          className={cn(externalLink, "text-[13px] font-medium")}
        >
          <span className="truncate">{message.group?.title ?? `Chat ${message.chatId}`}</span>
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        </a>
        <span className="shrink-0 font-mono text-xs text-(--pn-fg-muted) tabular-nums max-sm:hidden">
          Chat {message.chatId}
        </span>
        <time
          dateTime={message.timestamp.toISOString()}
          className="ml-auto shrink-0 text-xs whitespace-nowrap text-(--pn-fg-muted) tabular-nums"
        >
          {formatDateTime(message.timestamp)}
        </time>
      </div>
      <p className="border-l-2 border-(--pn-line-strong) pl-3 text-[13px] leading-5 text-pretty whitespace-pre-wrap text-(--pn-fg)">
        {message.message}
      </p>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono text-(--pn-fg-muted) tabular-nums">Message #{message.messageId}</span>
        <a href={link} target="_blank" rel="noreferrer" className={externalLink}>
          Open message
          <ExternalLink aria-hidden className="size-3 shrink-0" />
        </a>
      </div>
    </li>
  )
}

const auditColumns: DataTableColumn<Audit>[] = [
  { id: "type", label: "Type", minWidth: 120, cell: (audit) => audit.type },
  {
    id: "date",
    label: "Date",
    minWidth: 170,
    className: "whitespace-nowrap tabular-nums",
    cell: (audit) => formatDateTime(audit.createdAt),
  },
  {
    id: "reason",
    label: "Reason",
    priority: 2,
    minWidth: 180,
    className: "max-w-[280px]",
    cell: (audit) =>
      audit.reason ? (
        <span className="block truncate" title={audit.reason}>
          {audit.reason}
        </span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "group",
    label: "Group",
    priority: 1,
    minWidth: 220,
    cell: (audit) =>
      audit.groupTitle && audit.groupId !== null ? (
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="truncate" title={audit.groupTitle}>
            {audit.groupTitle}
          </span>
          <span className="shrink-0 text-(--pn-fg-muted)">·</span>
          <span className="shrink-0 font-mono text-(--pn-fg-muted) tabular-nums">{audit.groupId}</span>
        </span>
      ) : (
        <Unset />
      ),
  },
]
