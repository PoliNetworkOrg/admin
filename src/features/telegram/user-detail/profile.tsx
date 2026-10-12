import { Link } from "@tanstack/react-router"
import { CalendarPlus, ExternalLink, ShieldX, UserX } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  buttonTones,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  CopyableText,
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

  const messagesCard = messages && (
    <SectionCard title="Recent messages" count={messages.length} padding="flush">
      {messages.length === 0 ? (
        <SectionEmpty title="No recent messages from this user" />
      ) : (
        <ol className="divide-y divide-(--pn-line)">
          {messages.map((message) => (
            <MessageRow key={`${message.chatId}-${message.messageId}`} message={message} />
          ))}
        </ol>
      )}
    </SectionCard>
  )
  const grantsCard = grants && <GrantsSection ongoing={grants.ongoing} scheduled={grants.scheduled} />

  return (
    <>
      <PageBar width="record" back={BACK} context={String(user.id)} contextMono right={headerActions} />
      <PageContent width="record">
        <div className="flex flex-col gap-6">
          <RecordHeader
            title={name}
            avatar={
              <span
                aria-hidden
                className="grid size-16 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) text-[20px] font-semibold text-(--pn-fg) max-shell:size-13 max-shell:text-[17px]"
              >
                {initialsOf(name)}
              </span>
            }
            badge={grants?.ongoing ? <StatusBadge tone="success">Grant active</StatusBadge> : undefined}
            meta={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {user.username ? <span>@{user.username}</span> : <span>No username</span>}
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  Telegram ID{" "}
                  <CopyableText value={String(user.id)} what="Telegram ID" className="font-mono text-(--pn-fg)" />
                </span>
              </span>
            }
          />

          {messagesCard && grantsCard ? (
            <div className="grid items-start gap-4 min-[1000px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              {messagesCard}
              {grantsCard}
            </div>
          ) : (
            (messagesCard ?? grantsCard)
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
  // `tg.grants.checkUser` returns the ongoing grant without a key or reason; a user has at most one.
  const count = (ongoing ? 1 : 0) + scheduled.length
  return (
    <SectionCard title="Grants" count={count} padding="flush">
      {count === 0 ? (
        <SectionEmpty
          title="No active or scheduled grants"
          hint="Grants let this user send links without automatic moderation."
        />
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          {ongoing ? (
            <li className="flex flex-col gap-2.5 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Ongoing</span>
                <StatusBadge tone="success">Active</StatusBadge>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 text-[13px]">
                <dt className="text-(--pn-fg-muted)">From</dt>
                <dd className="tabular-nums">{formatDateTime(ongoing.validSince)}</dd>
                <dt className="text-(--pn-fg-muted)">Until</dt>
                <dd className="tabular-nums">{formatDateTime(ongoing.validUntil)}</dd>
              </dl>
            </li>
          ) : null}
          {scheduled.map((grant) => (
            <li
              key={grant.key}
              className="flex flex-col gap-1.5 rounded-(--pn-r-4) border border-dashed border-(--pn-line-strong) p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Scheduled</span>
                <StatusBadge tone="brand">Scheduled</StatusBadge>
              </div>
              <span className="text-[13px] text-(--pn-fg-muted) tabular-nums">
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
    <li className="flex flex-col gap-2 px-4.5 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
        <a
          href={message.group?.inviteLink ?? link}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate font-semibold text-(--pn-fg) transition-[color] duration-120 hover:text-(--pn-accent)"
        >
          {message.group?.title ?? `Chat ${message.chatId}`}
        </a>
        <span className="shrink-0 font-mono text-xs text-(--pn-fg-muted) tabular-nums max-sm:hidden">
          Chat {message.chatId}
        </span>
        <time
          dateTime={message.timestamp.toISOString()}
          className="ml-auto shrink-0 whitespace-nowrap text-(--pn-fg-muted) tabular-nums"
        >
          {formatDateTime(message.timestamp)}
        </time>
      </div>
      <blockquote className="rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-sunken) px-3 py-2.5 text-[14px] leading-5 text-pretty whitespace-pre-wrap text-(--pn-fg)">
        {message.message}
      </blockquote>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-mono text-(--pn-fg-muted) tabular-nums">Message #{message.messageId}</span>
        <a href={link} target="_blank" rel="noreferrer" className={cn(externalLink, "font-medium")}>
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
  { id: "type", label: "Type", minWidth: 120, cell: (audit) => <Chip>{audit.type}</Chip> },
  { id: "client", label: "Client", minWidth: 120, cell: (audit) => audit.client ?? <Unset /> },
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
