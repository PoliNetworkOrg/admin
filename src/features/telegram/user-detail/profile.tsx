import { Link } from "@tanstack/react-router"
import { CalendarPlus, ExternalLink, ShieldX, UserX } from "lucide-react"
import { useRef, useState } from "react"

import {
  buttonMotion,
  buttonTones,
  DataTable,
  type DataTableColumn,
  EmptyState,
  initialsOf,
  RecordHeader,
  SectionCard,
  SectionEmpty,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { CreateGrantDialog } from "@/components/telegram/create-grant-dialog"
import { telegramUserName } from "@/components/telegram/telegram-user"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { TgGrant } from "@/lib/api/types"
import { formatDateTime, formatRange } from "@/lib/format"
import { cn } from "@/lib/utils"

import { InterruptGrantDialog } from "./grant-dialogs"
import type { TelegramUserDetail } from "./types"

const BACK = { label: "users", link: { to: "/dashboard/telegram/users" } } as const

type Message = NonNullable<TelegramUserDetail["messages"]>[number]
type Audit = NonNullable<TelegramUserDetail["audits"]>[number]

export function TelegramUserNotFound({ userId }: { userId: string }) {
  return (
    <>
      <PageBar width="record" back={BACK} context={userId} contextMono />
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

type OpenDialog = "none" | "grant" | "end-grant"

/**
 * Telegram user detail: grants, messages, audit log, each shown only with its read permission. Roles live in the
 * IdP now (RFC v3 §11.4), so there is no role or group-admin management here.
 */
export function TelegramUserDetailPage({ data }: { data: TelegramUserDetail }) {
  const { user, messages, audits, grants } = data
  const canWrite = useCan("tg:grants:manage")
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [dialog, setDialog] = useState<OpenDialog>("none")
  const name = telegramUserName(user)

  function closeDialog(open: boolean) {
    if (!open) setDialog("none")
  }

  const headerActions = canWrite ? (
    <>
      {grants?.ongoing && (
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
        width="record"
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
          />

          {grants && <GrantsSection ongoing={grants.ongoing} scheduled={grants.scheduled} />}

          {messages && (
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
          )}

          {audits && (
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
          )}
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
        </>
      )}
    </>
  )
}

type GrantWindow = Pick<TgGrant, "validSince" | "validUntil">

type GrantsSectionProps = { ongoing: GrantWindow | null; scheduled: (GrantWindow & { key: string })[] }

function GrantsSection({ ongoing, scheduled }: GrantsSectionProps) {
  // `tg.grants.checkUser` returns the ongoing grant without a key; a user has at most one.
  const rows = [
    ...(ongoing ? [{ key: "ongoing", grant: ongoing, label: "Ongoing", status: "active" as const }] : []),
    ...scheduled.map((grant) => ({ key: grant.key, grant, label: "Scheduled", status: "scheduled" as const })),
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
          {rows.map(({ key, grant, label, status }) => (
            <li key={key} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2">
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
  {
    id: "actor",
    label: "Actor",
    minWidth: 160,
    cell: (audit) => audit.actorSub ?? audit.actorTgId ?? audit.adminId ?? <Unset />,
  },
  { id: "client", label: "Client", minWidth: 120, cell: (audit) => audit.client ?? <Unset /> },
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
