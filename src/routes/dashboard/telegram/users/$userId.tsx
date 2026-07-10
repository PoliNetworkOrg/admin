import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  History,
  MessageCircle,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"
import { LiveStatus } from "@/components/live-status"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTelegramUserDetails } from "@/server/api.functions"

export const Route = createFileRoute("/dashboard/telegram/users/$userId")({
  loader: ({ params }) => getTelegramUserDetails({ data: { userId: Number.parseInt(params.userId, 10) } }),
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
  const data = Array.isArray(response.data) ? null : response.data

  if (!data) {
    return (
      <div className="animate-appear">
        <BackLink />
        <LiveStatus connected={response.connected} message={response.message} />
        <Card className="mt-[18px] rounded-none border-dashed py-0 text-center shadow-none">
          <CardContent className="px-5 py-14">
            <UserRound className="mx-auto text-primary" />
            <h2 className="mt-2 font-serif text-[21px] font-normal tracking-[-0.04em]">User not found</h2>
            <p className="mt-2 text-xs text-muted-foreground">No Telegram user exists with ID {userId}.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user, roles, groupAdmin, messages, audits, grant } = data
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"

  return (
    <div className="animate-appear">
      <BackLink />
      <section className="mt-[18px] flex items-center gap-[18px] bg-sidebar px-[35px] py-[35px] text-[#eff1e9] max-[600px]:grid max-[600px]:grid-cols-[55px_1fr] max-[600px]:px-6 max-[600px]:py-6">
        <div className="grid size-[58px] shrink-0 place-items-center rounded-full bg-sidebar-primary font-mono text-[17px] text-sidebar">
          {(user.firstName?.[0] ?? user.username?.[0] ?? String(user.id).slice(-2)).toUpperCase()}
        </div>
        <div>
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-sidebar-primary">
            TELEGRAM PROFILE · {user.id}
          </p>
          <h2 className="mt-1 font-serif text-[26px] font-normal tracking-[-0.05em]">{displayName}</h2>
          <p className="text-[11px] text-[#b4c0b7]">{user.username ? `@${user.username}` : "No Telegram username"}</p>
        </div>
        <Badge
          variant="secondary"
          className="ml-auto h-5 rounded-none bg-muted px-1.5 font-mono text-[9px] text-muted-foreground max-[600px]:col-span-full max-[600px]:ml-0"
        >
          {roles.length} role{roles.length === 1 ? "" : "s"}
        </Badge>
      </section>

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
                <Badge key={role} className="h-5 rounded-none bg-accent px-1.5 font-mono text-[9px] text-primary">
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

      <DetailSection icon={UsersRound} title="Group administration" count={groupAdmin.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {groupAdmin
            .filter((entry) => entry !== null)
            .map((entry) => (
              <Card className="rounded-none py-0 shadow-none" key={entry.group.id}>
                <CardContent className="p-5">
                  <h3 className="text-[13px]">{entry.group.title}</h3>
                  <p className="mt-1 font-mono text-[10px] text-[#51647f]">{entry.group.id}</p>
                  <small className="mt-3 block text-[10px] text-muted-foreground">
                    Added by {entry.addedBy.firstName}
                    {entry.addedBy.username ? ` · @${entry.addedBy.username}` : ""}
                  </small>
                </CardContent>
              </Card>
            ))}
          {!groupAdmin.length && <SectionEmpty text="This user does not administer any group." />}
        </div>
      </DetailSection>
      <DetailSection icon={MessageCircle} title="Recent messages" count={messages.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {messages.map((message) => (
            <Card className="rounded-none py-0 shadow-none" key={`${message.chatId}-${message.messageId}`}>
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
                  Open message <ExternalLink />
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
            <Card className="rounded-none py-0 shadow-none" key={`${audit.id}-${audit.type}`}>
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
      <ArrowLeft /> Back to users
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
    <Card className="rounded-none py-0 shadow-none">
      <CardHeader className="gap-3 p-5 pb-3">
        <Icon className="text-primary" />
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
    <p className="border border-dashed border-border px-5 py-8 text-center text-[11px] text-muted-foreground">{text}</p>
  )
}

function DetailSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof UserRound
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="mt-[34px]">
      <header className="mb-3 flex items-center justify-between border-b border-border pb-3">
        <span className="flex items-center gap-2">
          <Icon className="text-primary" />
          <h2 className="font-serif text-[20px] font-normal tracking-[-0.04em]">{title}</h2>
        </span>
        <b className="font-mono text-[10px] text-muted-foreground">{count}</b>
      </header>
      {children}
    </section>
  )
}
