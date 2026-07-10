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
      <div className="profile-page reveal">
        <Link to="/dashboard/telegram/users" className="back-link">
          <ArrowLeft size={16} /> Back to users
        </Link>
        <LiveStatus connected={response.connected} message={response.message} />
        <div className="empty-profile">
          <UserRound size={26} />
          <h2>User not found</h2>
          <p>No Telegram user exists with ID {userId}.</p>
        </div>
      </div>
    )
  }

  const { user, roles, groupAdmin, messages, audits, grant } = data
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"

  return (
    <div className="profile-page reveal">
      <Link to="/dashboard/telegram/users" className="back-link">
        <ArrowLeft size={16} /> Back to users
      </Link>
      <section className="profile-hero">
        <div className="profile-avatar">
          {(user.firstName?.[0] ?? user.username?.[0] ?? String(user.id).slice(-2)).toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">TELEGRAM PROFILE · {user.id}</p>
          <h2>{displayName}</h2>
          <p>{user.username ? `@${user.username}` : "No Telegram username"}</p>
        </div>
        <span className="status-pill quiet">
          {roles.length} role{roles.length === 1 ? "" : "s"}
        </span>
      </section>

      <section className="detail-summary-grid">
        <article className="detail-card">
          <UserRound size={18} />
          <p className="eyebrow">IDENTITY</p>
          <dl>
            <div>
              <dt>Telegram ID</dt>
              <dd className="mono">{user.id}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{displayName}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{user.username ? `@${user.username}` : "—"}</dd>
            </div>
          </dl>
        </article>
        <article className="detail-card">
          <ShieldCheck size={18} />
          <p className="eyebrow">ROLES</p>
          <div className="role-list">
            {roles.length ? (
              roles.map((role) => (
                <span className="tag" key={role}>
                  {role}
                </span>
              ))
            ) : (
              <span className="muted">No assigned roles</span>
            )}
          </div>
        </article>
        <article className="detail-card">
          <CalendarClock size={18} />
          <p className="eyebrow">ACCESS GRANT</p>
          {grant ? (
            <dl>
              <div>
                <dt>Valid from</dt>
                <dd>{formatDate(grant.validSince)}</dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(grant.validUntil)}</dd>
              </div>
            </dl>
          ) : (
            <span className="muted">No ongoing grant</span>
          )}
        </article>
      </section>

      <DetailSection icon={UsersRound} title="Group administration" count={groupAdmin.length}>
        <div className="detail-grid">
          {groupAdmin
            .filter((entry) => entry !== null)
            .map((entry) => (
              <article className="activity-card" key={entry.group.id}>
                <h3>{entry.group.title}</h3>
                <p className="mono">{entry.group.id}</p>
                <small>
                  Added by {entry.addedBy.firstName}
                  {entry.addedBy.username ? ` · @${entry.addedBy.username}` : ""}
                </small>
              </article>
            ))}
          {!groupAdmin.length && <p className="section-empty">This user does not administer any group.</p>}
        </div>
      </DetailSection>

      <DetailSection icon={MessageCircle} title="Recent messages" count={messages.length}>
        <div className="detail-grid">
          {messages.map((message) => (
            <article className="activity-card message-card" key={`${message.chatId}-${message.messageId}`}>
              <div>
                <h3>{message.group?.title ?? `Chat ${message.chatId}`}</h3>
                <time>{formatDate(message.timestamp)}</time>
              </div>
              <p>{message.message}</p>
              <a href={messageLink(message.chatId, message.messageId)} target="_blank" rel="noreferrer">
                Open message <ExternalLink size={13} />
              </a>
            </article>
          ))}
          {!messages.length && <p className="section-empty">No recent messages from this user.</p>}
        </div>
      </DetailSection>

      <DetailSection icon={History} title="Audit log" count={audits.length}>
        <div className="detail-grid">
          {audits.map((audit) => (
            <article className="activity-card" key={`${audit.id}-${audit.type}`}>
              <div>
                <h3>{audit.type}</h3>
                <time>{formatDate(audit.createdAt)}</time>
              </div>
              <p>{audit.reason ?? "No reason provided"}</p>
              {audit.groupTitle && (
                <small>
                  {audit.groupTitle} · {audit.groupId}
                </small>
              )}
            </article>
          ))}
          {!audits.length && <p className="section-empty">No audit events found for this user.</p>}
        </div>
      </DetailSection>
    </div>
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
    <section className="detail-section">
      <header>
        <span>
          <Icon size={17} />
          <h2>{title}</h2>
        </span>
        <b>{count}</b>
      </header>
      {children}
    </section>
  )
}
