import { Link } from "@tanstack/react-router"
import { CircleCheck, CircleDashed } from "lucide-react"
import { useState } from "react"
import type { z } from "zod"

import { checkboxControl, ConfirmDialog, InlineAlert } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import { contactFunctionLabel, panelClass } from "./portal-ui"
import type { calendarEventListSchema, Contact, Detail, promotionListSchema } from "./portal.contract"

type Step = { done: boolean; title: string; children: React.ReactNode }

function HandoverStep({ done, title, children }: Step) {
  const Icon = done ? CircleCheck : CircleDashed
  return (
    <li className="flex gap-3 border-t border-(--pn-line) pt-4">
      <Icon
        aria-hidden
        className={`mt-0.5 size-5 shrink-0 ${done ? "text-(--pn-success-fg)" : "text-(--pn-fg-muted)"}`}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="text-sm font-medium">
          {title}
          <span className="sr-only">{done ? " (fatto)" : " (da fare)"}</span>
        </h3>
        {children}
      </div>
    </li>
  )
}

/**
 * The guided change of responsible. The outgoing responsible invites the successor (approved by PoliNetwork as
 * usual), reviews the contacts with personal data, sees what is still open, and completes it; everything else stays
 * with the association.
 */
export function HandoverCard({
  association: a,
  userSub,
  promotions,
  events,
  onInvite,
  onAction,
}: {
  association: Detail
  userSub: string
  promotions: z.infer<typeof promotionListSchema>
  events: z.infer<typeof calendarEventListSchema>
  onInvite: () => void
  onAction: (
    action:
      | { action: "handoverStart" }
      | { action: "handoverConfirm"; contactIds: string[] }
      | { action: "handoverComplete"; leave: boolean }
      | { action: "handoverCancel" }
  ) => Promise<void>
}) {
  const h = a.handoverState
  const [leave, setLeave] = useState(true)
  const responsible = a.role === "responsible"
  if (!h) {
    if (!responsible || a.status !== "active") return null
    return (
      <section className={panelClass} aria-labelledby="handover-title">
        <h2 id="handover-title" className="font-medium">
          Passaggio di consegne
        </h2>
        <p className="text-sm text-(--pn-fg-muted)">
          Stai lasciando la guida dell’associazione? Il passaggio ti accompagna: inviti chi ti succede, rivedi i
          contatti personali e controlli richieste ed eventi aperti. Lo storico resta all’associazione.
        </p>
        <ConfirmDialog
          title="Avviare il passaggio di consegne?"
          description="Gli altri responsabili e PoliNetwork lo vedranno in corso finché non lo completi o lo annulli."
          confirmLabel="Avvia passaggio"
          cancelLabel="Annulla"
          tone="primary"
          onConfirm={() => onAction({ action: "handoverStart" })}
          trigger={<Button variant="outline">Avvia passaggio di consegne</Button>}
        />
      </section>
    )
  }
  const mine = h.startedBy === userSub
  const all: Contact[] = [
    ...(
      a.requests.find((q) => q.kind === "content" && ["draft", "changes", "submitted"].includes(q.status))?.profile ??
      a.profile
    ).contacts,
    ...a.contacts,
  ]
  const toReview = all.filter((c) => h.contactsToReview.includes(c.id))
  const openPromotions = promotions.filter((p) =>
    ["draft", "submitted", "changes_requested", "approved", "scheduled"].includes(p.status)
  )
  const openEvents = events.filter((e) => ["draft", "submitted", "changes_requested"].includes(e.status))
  return (
    <section className={panelClass} aria-labelledby="handover-title">
      <h2 id="handover-title" className="font-medium">
        Passaggio di consegne in corso
      </h2>
      <p className="text-sm text-(--pn-fg-muted)">
        Avviato da {h.startedByName}.{" "}
        {mine ? "Completa i passaggi qui sotto." : "Solo chi l’ha avviato può completarlo."}
      </p>
      <ol className="space-y-4">
        <HandoverStep done={h.successorReady} title="1. Invita chi ti succede come responsabile">
          <p className="text-sm text-(--pn-fg-muted)">
            {h.successorReady
              ? "C’è un altro responsabile approvato da PoliNetwork."
              : "La persona accetta l’invito con il proprio account, poi PoliNetwork approva il collegamento."}
          </p>
          {mine && !h.successorReady && (
            <Button variant="outline" onClick={onInvite}>
              Invita il nuovo responsabile
            </Button>
          )}
        </HandoverStep>
        <HandoverStep done={toReview.length === 0} title="2. Rivedi i contatti personali">
          {toReview.length === 0 ? (
            <p className="text-sm text-(--pn-fg-muted)">Contatti rivisti.</p>
          ) : (
            <>
              <p className="text-sm text-(--pn-fg-muted)">
                Contengono nomi o telefoni, o si riferiscono a te: aggiornali nella scheda Contatti, poi confermali.
              </p>
              <ul className="space-y-1 text-sm">
                {toReview.map((c) => (
                  <li key={c.id}>
                    {c.label} · {contactFunctionLabel[c.function]}
                    {c.name ? ` · ${c.name}` : ""}
                  </li>
                ))}
              </ul>
              {mine && (
                <Button
                  variant="outline"
                  onClick={() => onAction({ action: "handoverConfirm", contactIds: toReview.map((c) => c.id) })}
                >
                  Confermo che sono aggiornati
                </Button>
              )}
            </>
          )}
        </HandoverStep>
        <HandoverStep
          done={openPromotions.length + openEvents.length === 0}
          title="3. Controlla richieste ed eventi aperti"
        >
          {openPromotions.length + openEvents.length === 0 ? (
            <p className="text-sm text-(--pn-fg-muted)">Niente di aperto.</p>
          ) : (
            <>
              <p className="text-sm text-(--pn-fg-muted)">
                Restano all’associazione: chi ti succede li ritrova. Ritira quelli che non servono più.
              </p>
              <ul className="space-y-1 text-sm">
                {openPromotions.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/dashboard/associations/promotions/$promotionId"
                      params={{ promotionId: p.id }}
                      className="underline"
                    >
                      Promozione: {p.content.title || "senza titolo"}
                    </Link>
                  </li>
                ))}
                {openEvents.map((e) => (
                  <li key={e.id}>
                    <Link to="/dashboard/associations/events/$eventId" params={{ eventId: e.id }} className="underline">
                      Evento: {e.content.title || "senza titolo"}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </HandoverStep>
      </ol>
      {mine && (
        <div className="space-y-3 border-t border-(--pn-line) pt-4">
          {!(h.successorReady && toReview.length === 0) && (
            <InlineAlert tone="neutral">Per completare servono un nuovo responsabile e i contatti rivisti.</InlineAlert>
          )}
          <label className="flex items-start gap-2.5 text-[14px]">
            <Checkbox checked={leave} onCheckedChange={(v) => setLeave(v === true)} className={checkboxControl} />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Lascio l’associazione al termine</span>
              <span className="text-[13px] text-(--pn-fg-muted)">
                Perderai l’accesso; potrai richiederlo di nuovo in futuro.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              title="Completare il passaggio di consegne?"
              description={
                leave
                  ? "Lascerai l’associazione: richieste, eventi e storico restano a chi ti succede."
                  : "Resterai referente dell’associazione insieme a chi ti succede."
              }
              confirmLabel="Completa passaggio"
              cancelLabel="Annulla"
              tone="primary"
              onConfirm={() => onAction({ action: "handoverComplete", leave })}
              trigger={<Button disabled={!(h.successorReady && toReview.length === 0)}>Completa passaggio</Button>}
            />
            <ConfirmDialog
              title="Annullare il passaggio di consegne?"
              description="I passaggi fatti restano nello storico."
              confirmLabel="Annulla passaggio"
              cancelLabel="Indietro"
              onConfirm={() => onAction({ action: "handoverCancel" })}
              trigger={<Button variant="ghost">Annulla passaggio</Button>}
            />
          </div>
        </div>
      )}
      {!mine && a.operator && (
        <ConfirmDialog
          title="Chiudere il passaggio di consegne?"
          description="Usalo se il passaggio è fermo. I passaggi fatti restano nello storico."
          confirmLabel="Chiudi passaggio"
          cancelLabel="Indietro"
          onConfirm={() => onAction({ action: "handoverCancel" })}
          trigger={<Button variant="ghost">Chiudi passaggio</Button>}
        />
      )}
    </section>
  )
}
