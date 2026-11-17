import { Link, useRouteContext, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { FormDialog, FormField, RecordHeader, SegmentedControl, SelectField } from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDate, formatDateTime } from "@/lib/format"

import { reviewPortalAssociation } from "./portal-review.functions"
import {
  cleanProfile,
  panelClass,
  parseForm,
  ProfileFields,
  ProfilePreview,
  ReasonDialog,
  roleOptions,
  statusLabel,
  TextField,
} from "./portal-ui"
import {
  commandSchema,
  isOperatorAction,
  type Command,
  type Detail,
  type Profile,
  type Request,
} from "./portal.contract"
import { changePortalAssociation, getPortalDirectory } from "./portal.functions"

type Action = Command extends infer T ? (T extends Command ? Omit<T, "id" | "revision" | "commandId"> : never) : never
export function PortalDetail({ association: a }: { association: Detail }) {
  const router = useRouter()
  const { user } = useRouteContext({ from: "/dashboard" })
  const change = useServerFn(changePortalAssociation)
  const directory = useServerFn(getPortalDirectory)
  const [destinations, setDestinations] = useState<{ id: string; name: string }[]>([])
  const [redirecting, setRedirecting] = useState<Request | null>(null)
  const [destination, setDestination] = useState<string | null>(null)
  const [redirectReason, setRedirectReason] = useState("")
  const review = useServerFn(reviewPortalAssociation)
  const [tab, setTab] = useState<"profile" | "requests" | "members" | "activity">("profile")
  const [edit, setEdit] = useState<{ requestId: string | null; profile: Profile; explanation: string } | null>(null)
  const [reasonAction, setReasonAction] = useState<{
    title: string
    description?: string
    danger?: boolean
    initial?: string
    required?: boolean
    action: (reason: string) => Action
  } | null>(null)
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"responsible" | "collaborator">("collaborator")
  const [explanation, setExplanation] = useState("")
  const [notes, setNotes] = useState(a.notes ?? "")
  const [syncedNotes, setSyncedNotes] = useState(a.notes ?? "")
  // Another operator may have saved notes since this page loaded: follow the loader unless there are unsaved edits.
  if ((a.notes ?? "") !== syncedNotes) {
    if (notes === syncedNotes) setNotes(a.notes ?? "")
    setSyncedNotes(a.notes ?? "")
  }
  const [busy, setBusy] = useState(false)
  async function run(action: Action) {
    const command = parseForm(commandSchema, {
      ...action,
      id: a.id,
      revision: a.revision,
      commandId: crypto.randomUUID(),
    })
    if (isOperatorAction(action.action)) await review({ data: command })
    else await change({ data: command })
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning(
        "La modifica è salvata, ma la pagina non si è aggiornata. Ricaricala senza ripetere l’operazione."
      )
      return
    }
    appToast.success("Modifica salvata.")
  }
  async function immediate(action: Action) {
    if (busy) return
    setBusy(true)
    try {
      await run(action)
    } catch (error) {
      console.error(error)
      appToast.error(error instanceof Error ? error.message : "Operazione non riuscita")
    } finally {
      setBusy(false)
    }
  }
  const working = a.requests.find((q) => q.kind === "content" && ["draft", "changes", "submitted"].includes(q.status))
  const registration = a.requests.find(
    (q) => q.kind === "registration" && q.by === user.sub && ["draft", "changes"].includes(q.status)
  )
  function askReview(q: Request, decision: "approve" | "changes" | "reject") {
    setReasonAction({
      title:
        decision === "approve"
          ? `Approva ${statusLabel[q.kind].toLowerCase()}`
          : decision === "changes"
            ? "Richiedi integrazioni"
            : "Rifiuta richiesta",
      description:
        q.kind === "registration"
          ? "L’approvazione crea il collegamento al primo responsabile. La scheda non viene pubblicata."
          : q.kind === "content"
            ? "L’approvazione sostituisce la versione pubblicata con questa proposta."
            : "Verifica la persona e il suo ruolo prima di concedere o cambiare l’accesso.",
      danger: decision === "reject",
      action: (reason) => ({ action: "review", requestId: q.id, decision, reason }),
    })
  }
  return (
    <>
      <PageBar
        back={{ label: "Associazioni", link: { to: "/dashboard/associations" } }}
        crumb="Associazioni"
        context={a.name}
      />
      <PageContent width="record">
        <div className="space-y-6">
          <RecordHeader
            title={a.name}
            meta={`${statusLabel[a.status]} · ${a.published ? "Scheda pubblicata" : "Non pubblicata"}`}
            actions={
              <>
                {a.canEdit && (!working || working.status !== "submitted") && (
                  <Button
                    onClick={() =>
                      setEdit({
                        requestId: working?.id ?? null,
                        profile: working?.profile ?? a.profile,
                        explanation: working?.explanation ?? "",
                      })
                    }
                  >
                    Modifica scheda
                  </Button>
                )}
                {registration && (
                  <Button
                    onClick={() =>
                      setEdit({
                        requestId: registration.id,
                        profile: registration.profile ?? a.profile,
                        explanation: registration.explanation,
                      })
                    }
                  >
                    Completa richiesta
                  </Button>
                )}
              </>
            }
          />
          {a.unrepresented && a.registered && a.operator && (
            <p className="rounded-lg border border-(--pn-line) p-3 text-sm">
              Nessun responsabile attivo. Invita un referente o esamina una richiesta di accesso.
            </p>
          )}
          {a.status === "suspended" && (
            <p className="text-sm">
              La gestione è sospesa. Le richieste restano consultabili; contatta PoliNetwork per la riattivazione.
            </p>
          )}
          <div className="overflow-x-auto">
            <SegmentedControl
              label="Sezioni associazione"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "profile", label: "Scheda" },
                { value: "requests", label: "Richieste", count: a.pending },
                { value: "members", label: "Referenti" },
                { value: "activity", label: "Attività" },
              ]}
            />
          </div>
          {tab === "profile" && (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className={panelClass}>
                <h2 className="font-medium">Sul sito</h2>
                <ProfilePreview profile={a.publishedProfile} />
              </section>
              <section className={panelClass}>
                <h2 className="font-medium">
                  {working ? `Proposta · ${statusLabel[working.status]}` : "Dati nel registro"}
                </h2>
                <ProfilePreview profile={working?.profile ?? a.profile} />
                {working && (
                  <Button variant="outline" onClick={() => setTab("requests")}>
                    Apri richiesta
                  </Button>
                )}
              </section>
            </div>
          )}
          {tab === "requests" && (
            <div className="space-y-4">
              {!a.requests.length && <p className="text-sm text-(--pn-fg-muted)">Non ci sono richieste.</p>}
              {[...a.requests].reverse().map((q) => (
                <section key={q.id} className={panelClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{statusLabel[q.kind]}</h2>
                    <span className="text-sm">{statusLabel[q.status]}</span>
                  </div>
                  <p className="text-sm text-(--pn-fg-muted)">
                    {q.byName} · {formatDate(new Date(q.createdAt))}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{q.explanation}</p>
                  {(q.kind === "membership" || q.kind === "access") && (
                    <p className="text-sm">
                      {q.targetName ?? q.email} · {statusLabel[q.role]}
                      {q.remove ? " · Rimozione richiesta" : ""}
                      {!q.accepted ? " · In attesa di accettazione" : " · Account confermato"}
                    </p>
                  )}
                  {q.response && (
                    <div className="rounded-lg bg-(--pn-muted) p-3 text-sm">
                      <p className="font-medium">Risposta di PoliNetwork · {q.decidedBy}</p>
                      <p className="whitespace-pre-wrap">{q.response}</p>
                    </div>
                  )}
                  {q.profile && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        {q.kind === "content" ? "Confronta versione pubblicata e proposta" : "Dati della richiesta"}
                      </summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {q.kind === "content" && (
                          <div>
                            <h3 className="mb-3 text-sm font-medium">Pubblicata</h3>
                            <ProfilePreview profile={a.publishedProfile} />
                          </div>
                        )}
                        <div>
                          <h3 className="mb-3 text-sm font-medium">Proposta</h3>
                          <ProfilePreview profile={q.profile} />
                        </div>
                      </div>
                    </details>
                  )}
                  {q.redirectId && (
                    <Link to="/dashboard/associations/$id" params={{ id: q.redirectId }} className="text-sm underline">
                      Apri la richiesta sul record esistente
                    </Link>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {a.operator && q.kind === "registration" && q.status === "submitted" && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            setDestinations(await directory())
                            setRedirecting(q)
                          } catch (error) {
                            console.error(error)
                            appToast.error("Impossibile caricare il registro")
                          }
                        }}
                      >
                        Collega a un record esistente
                      </Button>
                    )}
                    {a.operator && q.status === "submitted" && (
                      <>
                        <Button
                          disabled={(q.kind === "membership" || q.kind === "access") && !q.accepted}
                          onClick={() => askReview(q, "approve")}
                        >
                          Approva
                        </Button>
                        <Button variant="outline" onClick={() => askReview(q, "changes")}>
                          Chiedi integrazioni
                        </Button>
                        <Button variant="ghost" onClick={() => askReview(q, "reject")}>
                          Rifiuta
                        </Button>
                      </>
                    )}
                    {q.kind === "content" && a.canSubmit && q.status === "draft" && (
                      <Button disabled={busy} onClick={() => void immediate({ action: "submit", requestId: q.id })}>
                        Invia per pubblicazione
                      </Button>
                    )}
                    {q.kind === "registration" && q.by === user.sub && ["draft", "changes"].includes(q.status) && (
                      <Button disabled={busy} onClick={() => void immediate({ action: "submit", requestId: q.id })}>
                        Invia registrazione
                      </Button>
                    )}
                    {q.status === "changes" && q.by === user.sub && (
                      <Button
                        onClick={() =>
                          q.profile
                            ? setEdit({ requestId: q.id, profile: q.profile, explanation: q.explanation })
                            : setReasonAction({
                                title: "Rispondi a PoliNetwork",
                                initial: q.explanation,
                                action: (reason) => ({ action: "reply", requestId: q.id, explanation: reason }),
                              })
                        }
                      >
                        Integra richiesta
                      </Button>
                    )}
                    {q.kind === "content" && a.canSubmit && q.status === "changes" && (
                      <Button disabled={busy} onClick={() => void immediate({ action: "submit", requestId: q.id })}>
                        Invia integrazioni
                      </Button>
                    )}
                    {["draft", "submitted", "changes"].includes(q.status) &&
                      (q.by === user.sub || a.operator || (q.kind === "content" && a.canSubmit)) && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setReasonAction({
                              title: "Ritira richiesta",
                              description:
                                "Per inviarla di nuovo sarà necessaria una nuova richiesta. Gli inviti collegati non saranno più validi.",
                              danger: true,
                              required: false,
                              action: () => ({ action: "withdraw", requestId: q.id }),
                            })
                          }
                        >
                          Ritira
                        </Button>
                      )}
                  </div>
                </section>
              ))}
            </div>
          )}
          {tab === "members" && (
            <section className={panelClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">Referenti autorizzati</h2>
                {a.canManage && a.registered && <Button onClick={() => setInviting(true)}>Invita referente</Button>}
              </div>
              <p className="text-sm text-(--pn-fg-muted)">
                Ogni nuovo referente accetta con il proprio account; PoliNetwork approva poi il collegamento. I
                collaboratori preparano le schede, i responsabili le inviano.
              </p>
              {a.members
                .filter((m) => m.active)
                .map((m) => (
                  <div
                    key={m.sub}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-(--pn-line) pt-4"
                  >
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-(--pn-fg-muted)">{statusLabel[m.role]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.canManage && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setReasonAction({
                                title: "Proponi cambio di ruolo",
                                description: `Nuovo ruolo: ${m.role === "responsible" ? "Collaboratore" : "Responsabile"}. Richiede approvazione PoliNetwork.`,
                                action: (reason) => ({
                                  action: "membership",
                                  sub: m.sub,
                                  role: m.role === "responsible" ? "collaborator" : "responsible",
                                  remove: false,
                                  explanation: reason,
                                }),
                              })
                            }
                          >
                            Cambia ruolo
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setReasonAction({
                                title: "Proponi rimozione",
                                danger: true,
                                action: (reason) => ({
                                  action: "membership",
                                  sub: m.sub,
                                  role: m.role,
                                  remove: true,
                                  explanation: reason,
                                }),
                              })
                            }
                          >
                            Proponi rimozione
                          </Button>
                        </>
                      )}
                      {a.operator && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setReasonAction({
                              title: "Revoca accesso immediatamente",
                              description:
                                "La revoca è immediata anche se è l’ultimo responsabile. Lo storico viene conservato.",
                              danger: true,
                              action: (reason) => ({ action: "revoke", sub: m.sub, reason }),
                            })
                          }
                        >
                          Revoca
                        </Button>
                      )}
                      {m.sub === user.sub && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setReasonAction({
                              title: "Rinuncia all’accesso",
                              description:
                                "Per tornare a gestire questa associazione dovrai richiedere nuovamente accesso.",
                              danger: true,
                              action: (reason) => ({ action: "leave", reason }),
                            })
                          }
                        >
                          Rinuncia
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </section>
          )}
          {tab === "activity" && (
            <div className="space-y-5">
              <section className={panelClass}>
                <h2 className="font-medium">Storico</h2>
                {[...a.events].reverse().map((e) => (
                  <div key={e.id} className="border-t border-(--pn-line) pt-3 text-sm">
                    <p>{e.action}</p>
                    <p className="text-(--pn-fg-muted)">
                      {e.actor} · {formatDateTime(new Date(e.at))}
                    </p>
                    {e.detail && <p>{e.detail}</p>}
                  </div>
                ))}
              </section>
              {a.operator && (
                <section className={panelClass}>
                  <h2 className="font-medium">Note riservate a PoliNetwork</h2>
                  <TextField label="Note interne" value={notes} onChange={setNotes} multiline />
                  <Button
                    disabled={busy || notes === (a.notes ?? "")}
                    onClick={() => void immediate({ action: "note", note: notes })}
                  >
                    Salva note
                  </Button>
                </section>
              )}
            </div>
          )}
          {a.operator && a.registered && (
            <section className={panelClass}>
              <h2 className="font-medium">Gestione PoliNetwork</h2>
              <div className="flex flex-wrap gap-2">
                {a.status !== "active" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setReasonAction({
                        title: "Riattiva associazione",
                        description: "La riattivazione non ripubblica automaticamente la scheda.",
                        action: (reason) => ({ action: "status", status: "active", hide: false, reason }),
                      })
                    }
                  >
                    Riattiva
                  </Button>
                )}
                {a.status === "active" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setReasonAction({
                          title: "Sospendi la gestione",
                          description:
                            "I referenti non potranno modificare la scheda. La versione pubblicata resta online.",
                          danger: true,
                          action: (reason) => ({ action: "status", status: "suspended", hide: false, reason }),
                        })
                      }
                    >
                      Sospendi gestione
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setReasonAction({
                          title: "Sospendi e oscura",
                          description: "Blocca la gestione e rimuove la scheda dal sito.",
                          danger: true,
                          action: (reason) => ({ action: "status", status: "suspended", hide: true, reason }),
                        })
                      }
                    >
                      Sospendi e oscura
                    </Button>
                  </>
                )}
                {a.published && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setReasonAction({
                        title: "Rimuovi dal sito",
                        description: "Il record e i referenti rimangono nel registro.",
                        danger: true,
                        action: (reason) => ({ action: "unpublish", reason }),
                      })
                    }
                  >
                    Oscura scheda
                  </Button>
                )}
                {a.status !== "archived" && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setReasonAction({
                        title: "Archivia associazione",
                        description: "Conserva registro e storico, blocca la gestione e rimuove la scheda pubblica.",
                        danger: true,
                        action: (reason) => ({ action: "status", status: "archived", hide: true, reason }),
                      })
                    }
                  >
                    Archivia
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
        {edit && (
          <FormDialog
            open
            onOpenChange={(open) => {
              if (!open) setEdit(null)
            }}
            title="Modifica proposta"
            description="La versione pubblicata resta invariata fino all’approvazione."
            noun="scheda"
            locale="it"
            size="lg"
            dirty
            submitLabel="Salva bozza"
            onSubmit={async () => {
              await run({
                action: "save",
                requestId: edit.requestId,
                profile: cleanProfile(edit.profile),
                explanation: edit.explanation,
              })
              setEdit(null)
            }}
          >
            <ProfileFields
              associationId={a.id}
              value={edit.profile}
              onChange={(profile) => setEdit({ ...edit, profile })}
            />
            <TextField
              label="Motivazione e riferimenti per la verifica"
              value={edit.explanation}
              onChange={(explanation) => setEdit({ ...edit, explanation })}
              multiline
            />
          </FormDialog>
        )}
        <FormDialog
          open={!!redirecting}
          onOpenChange={(open) => {
            if (!open) setRedirecting(null)
          }}
          title="Associazione già nel registro"
          description="La registrazione verrà chiusa e diventerà una richiesta di accesso al record esistente, da approvare separatamente."
          noun="richiesta"
          locale="it"
          dirty={!!destination || !!redirectReason}
          submitLabel="Trasferisci richiesta"
          canSubmit={!!destination && !!redirectReason.trim()}
          onSubmit={async () => {
            if (!redirecting || !destination) return
            await run({
              action: "redirect",
              requestId: redirecting.id,
              destinationId: destination,
              reason: redirectReason,
            })
            setRedirecting(null)
          }}
        >
          <FormField label="Associazione esistente" htmlFor="destination-association">
            <SelectField
              id="destination-association"
              value={destination}
              onChange={setDestination}
              options={destinations.filter((d) => d.id !== a.id).map((d) => ({ value: d.id, label: d.name }))}
            />
          </FormField>
          <TextField label="Motivazione" value={redirectReason} onChange={setRedirectReason} multiline />
        </FormDialog>
        {reasonAction && (
          <ReasonDialog
            {...reasonAction}
            onClose={() => setReasonAction(null)}
            onSubmit={(reason) => run(reasonAction.action(reason))}
          />
        )}
        <FormDialog
          open={inviting}
          onOpenChange={setInviting}
          title="Invita un referente"
          noun="invito"
          locale="it"
          dirty={!!email || !!explanation}
          submitLabel="Invia invito"
          canSubmit={!!email.trim() && !!explanation.trim()}
          onSubmit={async () => {
            await run({ action: "invite", email, role, explanation })
            setInviting(false)
          }}
        >
          <TextField
            label="Email del referente"
            value={email}
            onChange={setEmail}
            type="email"
            hint="Serve solo a recapitare l’invito, non sarà pubblicata."
          />
          <FormField label="Ruolo proposto" htmlFor="invite-role">
            <SelectField id="invite-role" value={role} options={roleOptions} onChange={setRole} />
          </FormField>
          <TextField label="Motivazione" value={explanation} onChange={setExplanation} multiline />
        </FormDialog>
      </PageContent>
    </>
  )
}
