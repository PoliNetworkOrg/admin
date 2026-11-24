import { Link } from "@tanstack/react-router"
import { CircleAlert, CircleDot } from "lucide-react"
import type { z } from "zod"

import { NavCard } from "@/components/primitives"

import type { homeSchema } from "./portal.contract"

type Home = z.infer<typeof homeSchema>
type Action = Home["actions"][number]

const whenFormat = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})

/** The sentence for one action. A kind this version does not know is still shown, generically. */
export function actionText(a: Action) {
  const title = `“${a.title}”`
  switch (a.kind) {
    case "request_changes":
      return `PoliNetwork ha chiesto integrazioni alla tua richiesta per ${a.associationName}`
    case "profile_changes":
      return `PoliNetwork ha chiesto modifiche alla scheda di ${a.associationName}`
    case "profile_draft":
      return `Invia a PoliNetwork la proposta di scheda di ${a.associationName}`
    case "contacts_to_publish":
      return `Conferma i contatti da pubblicare per ${a.associationName}`
    case "stale_contacts":
      return `Aggiorna i contatti di ${a.associationName}: ${a.title}`
    case "profile_unpublished":
      return `Completa la scheda di ${a.associationName} e inviala per la pubblicazione`
    case "promotion_changes":
      return `PoliNetwork ha chiesto modifiche alla richiesta ${title}`
    case "promotion_to_submit":
      return `Completa e invia la richiesta ${title}`
    case "promotion_draft":
      return `Completa la richiesta ${title}`
    case "promotion_scheduled":
      return a.at ? `${title} è programmata per ${whenFormat.format(new Date(a.at))}` : `${title} è programmata`
    case "promotion_published":
      return `${title} è stata pubblicata`
    case "event_changes":
      return `PoliNetwork ha chiesto modifiche all’evento ${title}`
    case "event_to_submit":
      return `Completa e invia l’evento ${title}`
    case "event_draft":
      return `Completa l’evento ${title}`
    default:
      return `C’è qualcosa da controllare per ${a.associationName}`
  }
}

function actionLink(a: Action) {
  if (a.kind.startsWith("promotion_") && a.targetId)
    return { to: "/dashboard/associations/promotions/$promotionId", params: { promotionId: a.targetId } } as const
  if (a.kind.startsWith("event_") && a.targetId)
    return { to: "/dashboard/associations/events/$eventId", params: { eventId: a.targetId } } as const
  return { to: "/dashboard/associations/$id", params: { id: a.associationId } } as const
}

/** The top of the portal: what needs attention, then (operators) how much waits in each queue. */
export function PortalHome({ home }: { home: Home }) {
  const c = home.counters
  if (!home.actions.length && !c) return null
  return (
    <div className="space-y-4">
      {home.actions.length > 0 && (
        <section aria-labelledby="portal-todo" className="space-y-2">
          <h2 id="portal-todo" className="text-sm font-medium">
            Da fare
          </h2>
          <ul className="divide-y divide-(--pn-line) rounded-xl border border-(--pn-line) bg-(--pn-surface)">
            {home.actions.map((a) => {
              const Icon = a.urgent ? CircleAlert : CircleDot
              return (
                <li key={`${a.kind}-${a.associationId}-${a.targetId ?? ""}`}>
                  <Link {...actionLink(a)} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-(--pn-hover)">
                    <Icon
                      aria-hidden
                      className={`mt-0.5 size-4 shrink-0 ${a.urgent ? "text-(--pn-warning-fg)" : "text-(--pn-fg-muted)"}`}
                    />
                    <span className="min-w-0 flex-1">{actionText(a)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {c && (
        <section aria-labelledby="portal-queues" className="space-y-2">
          <h2 id="portal-queues" className="text-sm font-medium">
            Code di PoliNetwork
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NavCard
              title="Schede da approvare"
              count={c.profiles}
              render={<Link to="/dashboard/associations" search={{ view: "requests" }} />}
            />
            <NavCard
              title="Richieste di accesso"
              count={c.access}
              render={<Link to="/dashboard/associations" search={{ view: "requests" }} />}
            />
            <NavCard
              title="Promozioni in revisione"
              count={c.promotions}
              render={<Link to="/dashboard/associations/promotions" search={{ status: "submitted" }} />}
            />
            <NavCard
              title="Eventi in revisione"
              count={c.events}
              render={<Link to="/dashboard/associations/events" search={{ status: "submitted" }} />}
            />
          </div>
        </section>
      )}
    </div>
  )
}
