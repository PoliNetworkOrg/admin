import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, CheckCircle2, Database, ShieldCheck, UsersRound } from "lucide-react"

const actionCards = [
  {
    title: "Review member directory",
    text: "Update association numbers and licenses.",
    to: "/dashboard/azure/members",
    icon: UsersRound,
  },
  {
    title: "Manage access grants",
    text: "Check active and scheduled Telegram grants.",
    to: "/dashboard/telegram/grants",
    icon: ShieldCheck,
  },
  {
    title: "Browse Telegram groups",
    text: "Inspect group metadata and visibility settings.",
    to: "/dashboard/telegram/groups",
    icon: Database,
  },
]

export const Route = createFileRoute("/dashboard/")({ component: Overview })

function Overview() {
  return (
    <div className="overview reveal">
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">OPERATIONS CONTROL ROOM</p>
          <h2>
            Everything in order.
            <br />
            <i>Nothing overlooked.</i>
          </h2>
          <p className="lead">
            A focused workspace for the people who keep PoliNetwork’s communities, access and membership data moving.
          </p>
          <div className="health-line">
            <CheckCircle2 size={16} />
            <span>Workspace ready for review</span>
            <b>Last sync — just now</b>
          </div>
        </div>
        <div className="signal-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="metric-grid">
        <Metric value="4" label="Operational areas" note="Telegram + Azure" />
        <Metric value="24/7" label="Backend visibility" note="Live when connected" />
        <Metric value="Role-based" label="Access control" note="Sensitive actions protected" />
      </section>
      <section className="section-heading">
        <div>
          <p className="eyebrow">START HERE</p>
          <h2>Choose an operational area</h2>
        </div>
        <p>Every workspace is scoped to your administrator role.</p>
      </section>
      <section className="action-grid">
        {actionCards.map(({ title, text, to, icon: Icon }, index) => (
          <Link key={to} to={to} className="action-card" style={{ animationDelay: `${120 + index * 70}ms` }}>
            <span className="action-icon">
              <Icon size={20} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </section>
    </div>
  )
}

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <div>
        <h3>{label}</h3>
        <p>{note}</p>
      </div>
    </article>
  )
}
