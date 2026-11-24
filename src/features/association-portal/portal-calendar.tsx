import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CalendarDays } from "lucide-react"
import { useId, useState } from "react"
import type { z } from "zod"

import {
  checkboxControl,
  fieldControl,
  ConfirmDialog,
  DataTable,
  DateField,
  EmptyState,
  FileButton,
  FormDialog,
  FormField,
  InlineAlert,
  KeyValueList,
  RecordHeader,
  SegmentedControl,
  SelectField,
  StatusBadge,
  type DataTableColumn,
  type StatusTone,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

import { changePortalEvent, createPortalEvent } from "./event.functions"
import { CommentDialog, EMPTY_PROMOTION, formatMoment, NoteDialog, PromotionDialog } from "./portal-promotions"
import { reviewPortalEvent } from "./portal-review.functions"
import { catalogueName, panelClass, parseForm, TextField } from "./portal-ui"
import {
  type CalendarEventCommand,
  calendarEventCommandSchema,
  type CalendarEventContent,
  calendarEventContentSchema,
  type calendarEventSchema,
  type CatalogueEntry,
  type EventStatus,
  isEventOperatorAction,
  POSTER_MAX_BYTES,
} from "./portal.contract"
import { createPortalPromotion, uploadPortalPoster } from "./promotion.functions"

type CalendarEvent = z.infer<typeof calendarEventSchema>
type Action = CalendarEventCommand extends infer T
  ? T extends CalendarEventCommand
    ? Omit<T, "id" | "revision" | "commandId">
    : never
  : never

export const eventStatusLabel = {
  draft: "Bozza",
  submitted: "In revisione",
  changes_requested: "Modifiche richieste",
  approved: "Nel calendario",
  rejected: "Respinto",
  withdrawn: "Ritirato",
} satisfies Record<EventStatus, string>
const statusTone = {
  draft: "warning",
  submitted: "brand",
  changes_requested: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
} satisfies Record<EventStatus, StatusTone>

function EventStatusBadge({ status }: { status: EventStatus }) {
  return <StatusBadge tone={statusTone[status]}>{eventStatusLabel[status]}</StatusBadge>
}

const EMPTY_EVENT: CalendarEventContent = {
  title: "",
  descriptionIt: "",
  descriptionEn: "",
  startsAt: null,
  endsAt: null,
  online: false,
  venue: "",
  campus: null,
  link: "",
  poster: null,
}

/** Splits an ISO moment into the local day and time the fields edit, and joins them back. */
function splitMoment(iso: string | null) {
  if (!iso) return { day: "", time: "" }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}
const joinMoment = (day: string, time: string) => (day ? new Date(`${day}T${time || "00:00"}`).toISOString() : null)

function EventDialog({
  title,
  associationId,
  catalogue,
  initial,
  onClose,
  onSave,
}: {
  title: string
  associationId: string
  catalogue: CatalogueEntry[]
  initial: CalendarEventContent
  onClose: () => void
  onSave: (content: CalendarEventContent) => Promise<void>
}) {
  const id = useId()
  const upload = useServerFn(uploadPortalPoster)
  const [value, setValue] = useState(initial)
  const [start, setStart] = useState(() => splitMoment(initial.startsAt))
  const [end, setEnd] = useState(() => splitMoment(initial.endsAt))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const set = <K extends keyof CalendarEventContent>(key: K, next: CalendarEventContent[K]) =>
    setValue((current) => ({ ...current, [key]: next }))
  const campuses = catalogue.filter((e) => e.kind === "campus" && (e.active || e.slug === value.campus))
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description="L’evento compare nel calendario del sito solo dopo l’approvazione di PoliNetwork."
      noun="evento"
      locale="it"
      size="lg"
      dirty
      submitLabel="Salva bozza"
      onSubmit={() =>
        onSave(
          parseForm(calendarEventContentSchema, {
            ...value,
            startsAt: joinMoment(start.day, start.time),
            endsAt: joinMoment(end.day, end.time),
          })
        )
      }
    >
      <TextField label="Titolo" value={value.title} onChange={(v) => set("title", v)} maxLength={200} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Descrizione italiana"
          value={value.descriptionIt}
          onChange={(v) => set("descriptionIt", v)}
          multiline
          maxLength={5000}
        />
        <TextField
          label="Descrizione inglese"
          value={value.descriptionEn}
          onChange={(v) => set("descriptionEn", v)}
          multiline
          maxLength={5000}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormField htmlFor={`${id}-start`} label="Inizio">
          <DateField
            id={`${id}-start`}
            value={start.day}
            onChange={(day) => setStart({ ...start, day })}
            locale="it"
            pastYears={0}
            futureYears={1}
          />
        </FormField>
        <FormField htmlFor={`${id}-start-time`} label="Ora di inizio">
          <Input
            id={`${id}-start-time`}
            type="time"
            className={fieldControl}
            value={start.time}
            onChange={(e) => setStart({ ...start, time: e.target.value })}
          />
        </FormField>
        <FormField htmlFor={`${id}-end`} label="Fine (facoltativa)">
          <DateField
            id={`${id}-end`}
            value={end.day}
            onChange={(day) => setEnd({ ...end, day })}
            locale="it"
            pastYears={0}
            futureYears={1}
          />
        </FormField>
        <FormField htmlFor={`${id}-end-time`} label="Ora di fine">
          <Input
            id={`${id}-end-time`}
            type="time"
            className={fieldControl}
            value={end.time}
            onChange={(e) => setEnd({ ...end, time: e.target.value })}
          />
        </FormField>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]">
        <Checkbox
          checked={value.online}
          onCheckedChange={(checked) => set("online", checked === true)}
          className={checkboxControl}
        />
        <span className="font-medium">Evento online</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={value.online ? "Luogo (facoltativo)" : "Luogo"}
          value={value.venue}
          onChange={(v) => set("venue", v)}
          maxLength={300}
          hint="Ad esempio “Aula 3.1.2, edificio 3”."
        />
        <FormField htmlFor={`${id}-campus`} label="Sede (facoltativa)">
          <SelectField
            id={`${id}-campus`}
            value={value.campus ?? ""}
            options={[{ value: "", label: "Nessuna" }, ...campuses.map((e) => ({ value: e.slug, label: e.nameIt }))]}
            onChange={(campus) => set("campus", campus || null)}
          />
        </FormField>
      </div>
      <TextField
        label="Link (facoltativo)"
        type="url"
        value={value.link}
        onChange={(v) => set("link", v)}
        maxLength={2048}
      />
      <FormField
        htmlFor={`${id}-poster`}
        label="Locandina (facoltativa)"
        hint={value.poster ? "Locandina caricata. Puoi sostituirla." : "PNG o JPEG, massimo 5 MB."}
        error={uploadError}
      >
        <div className="flex flex-wrap items-center gap-3">
          {value.poster && (
            <img src={value.poster} alt="" referrerPolicy="no-referrer" className="h-16 rounded-md object-contain" />
          )}
          <FileButton
            id={`${id}-poster`}
            file={null}
            accept="image/png,image/jpeg"
            label={uploading ? "Caricamento…" : "Scegli un file"}
            invalid={!!uploadError}
            onChange={async (file) => {
              if (!file || uploading) return
              setUploadError("")
              setUploading(true)
              try {
                if (file.size > POSTER_MAX_BYTES) throw new Error("La locandina non può superare 5 MB")
                const data = new FormData()
                data.set("id", associationId)
                data.set("file", file)
                set("poster", (await upload({ data })).url)
              } catch (error) {
                console.error(error)
                setUploadError(error instanceof Error ? error.message : "Caricamento non riuscito")
              } finally {
                setUploading(false)
              }
            }}
          />
        </div>
      </FormField>
    </FormDialog>
  )
}

/** The association's events in its Eventi tab. */
export function EventsTab({
  associationId,
  events,
  catalogue,
  canCreate,
}: {
  associationId: string
  events: CalendarEvent[]
  catalogue: CatalogueEntry[]
  canCreate: boolean
}) {
  const router = useRouter()
  const create = useServerFn(createPortalEvent)
  const [creating, setCreating] = useState(false)
  const [commandId, setCommandId] = useState(() => crypto.randomUUID())
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Eventi nel calendario</h2>
        {canCreate && (
          <Button
            onClick={() => {
              setCommandId(crypto.randomUUID())
              setCreating(true)
            }}
          >
            Proponi un evento
          </Button>
        )}
      </div>
      <p className="text-sm text-(--pn-fg-muted)">
        Gli eventi approvati da PoliNetwork compaiono nel calendario del sito, collegati alla scheda dell’associazione.
      </p>
      {events.length === 0 ? (
        <p className="text-sm text-(--pn-fg-muted)">Non ci sono eventi.</p>
      ) : (
        <ul className="divide-y divide-(--pn-line)">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  to="/dashboard/associations/events/$eventId"
                  params={{ eventId: e.id }}
                  className="font-medium underline"
                >
                  {e.content.title || "Evento senza titolo"}
                </Link>
                <p className="text-sm text-(--pn-fg-muted)">
                  {e.content.startsAt ? formatMoment(e.content.startsAt) : "Data da scegliere"}
                  {e.content.online ? " · Online" : e.content.venue ? ` · ${e.content.venue}` : ""}
                </p>
              </div>
              <EventStatusBadge status={e.status} />
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <EventDialog
          title="Proponi un evento"
          associationId={associationId}
          catalogue={catalogue}
          initial={EMPTY_EVENT}
          onClose={() => setCreating(false)}
          onSave={async (content) => {
            const { id } = await create({ data: { associationId, content, commandId } })
            setCreating(false)
            await router.navigate({ to: "/dashboard/associations/events/$eventId", params: { eventId: id } })
          }}
        />
      )}
    </section>
  )
}

type Dialog =
  | { kind: "edit" }
  | { kind: "promote" }
  | { kind: "comment" }
  | {
      kind: "note"
      title: string
      description: string
      label: string
      required: boolean
      danger?: boolean
      action: (note: string) => Action
    }

/** One event: content, where it stands, its history, and the actions open to this viewer. */
export function EventPage({ event: e, catalogue }: { event: CalendarEvent; catalogue: CatalogueEntry[] }) {
  const router = useRouter()
  const change = useServerFn(changePortalEvent)
  const review = useServerFn(reviewPortalEvent)
  const promote = useServerFn(createPortalPromotion)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [promotionKey, setPromotionKey] = useState(() => crypto.randomUUID())
  async function run(action: Action, message: string) {
    const data = parseForm(calendarEventCommandSchema, {
      ...action,
      id: e.id,
      revision: e.revision,
      commandId: crypto.randomUUID(),
    })
    if (isEventOperatorAction(action.action) || (action.action === "comment" && e.operator)) await review({ data })
    else await change({ data })
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning(
        "La modifica è salvata, ma la pagina non si è aggiornata. Ricaricala senza ripetere l’operazione."
      )
      return
    }
    appToast.success(message)
  }
  const c = e.content
  const member = !e.operator
  // Promotion requests prefilled from the event: a few days ahead of it, for everyone.
  const prefilled = {
    ...EMPTY_PROMOTION,
    title: c.title,
    text: c.descriptionIt,
    link: c.link,
    poster: c.poster,
    desiredDate: c.startsAt
      ? new Date(Math.max(Date.now() + 86_400_000, Date.parse(c.startsAt) - 4 * 86_400_000)).toISOString().slice(0, 10)
      : null,
    eventId: e.id,
  }
  return (
    <>
      <PageBar
        back={
          e.operator
            ? { label: "Eventi", link: { to: "/dashboard/associations/events" } }
            : { label: e.associationName, link: { to: "/dashboard/associations/$id", params: { id: e.associationId } } }
        }
        crumb={e.associationName}
        context="Evento"
      />
      <PageContent width="record">
        <div className="space-y-6">
          <RecordHeader
            title={c.title || "Evento senza titolo"}
            badge={<EventStatusBadge status={e.status} />}
            meta={`${e.associationName} · proposto da ${e.createdByName}`}
            actions={
              <>
                {e.canEdit && <Button onClick={() => setDialog({ kind: "edit" })}>Modifica</Button>}
                {e.canSubmit && (
                  <ConfirmDialog
                    title="Inviare l’evento a PoliNetwork?"
                    description="Non potrai modificarlo mentre è in revisione."
                    confirmLabel="Invia evento"
                    cancelLabel="Annulla"
                    tone="primary"
                    onConfirm={() => run({ action: "submit" }, "Evento inviato.")}
                    trigger={<Button variant={e.canEdit ? "outline" : "default"}>Invia a PoliNetwork</Button>}
                  />
                )}
                {member && e.status === "approved" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPromotionKey(crypto.randomUUID())
                      setDialog({ kind: "promote" })
                    }}
                  >
                    Chiedi una promozione
                  </Button>
                )}
              </>
            }
          />
          {e.status === "changes_requested" && member && (
            <InlineAlert tone="warning">
              PoliNetwork ha chiesto delle modifiche: le trovi nello storico. Aggiorna l’evento e invialo di nuovo.
            </InlineAlert>
          )}
          {e.operator && (e.status === "submitted" || e.status === "approved") && (
            <section className={panelClass} aria-label="Decisione">
              <h2 className="font-medium">Decisione di PoliNetwork</h2>
              <div className="flex flex-wrap gap-2">
                {e.status === "submitted" && (
                  <>
                    <Button
                      onClick={() =>
                        setDialog({
                          kind: "note",
                          title: "Approva l’evento",
                          description: "L’evento compare subito nel calendario del sito.",
                          label: "Approva",
                          required: false,
                          action: (note) => ({ action: "approve", note }),
                        })
                      }
                    >
                      Approva
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDialog({
                          kind: "note",
                          title: "Chiedi modifiche",
                          description: "Il responsabile riceve la tua nota e può aggiornare l’evento.",
                          label: "Chiedi modifiche",
                          required: true,
                          action: (note) => ({ action: "changes", note }),
                        })
                      }
                    >
                      Chiedi modifiche
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  className="text-(--pn-danger-fg)"
                  onClick={() =>
                    setDialog({
                      kind: "note",
                      title: "Respingi l’evento",
                      description:
                        e.status === "approved"
                          ? "L’evento esce dal calendario del sito. Il responsabile riceve la motivazione."
                          : "L’evento non sarà pubblicato. Il responsabile riceve la motivazione.",
                      label: "Respingi",
                      required: true,
                      danger: true,
                      action: (note) => ({ action: "reject", note }),
                    })
                  }
                >
                  Respingi
                </Button>
              </div>
            </section>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
            <section className={panelClass} aria-label="Descrizione">
              <h2 className="font-medium">Descrizione</h2>
              {c.poster && (
                <img
                  src={c.poster}
                  alt="Locandina"
                  referrerPolicy="no-referrer"
                  className="max-h-64 rounded-lg object-contain"
                />
              )}
              <p className="text-xs font-medium text-(--pn-fg-muted)">IT</p>
              <p className="whitespace-pre-wrap text-sm">{c.descriptionIt || "—"}</p>
              <p className="text-xs font-medium text-(--pn-fg-muted)">EN</p>
              <p className="whitespace-pre-wrap text-sm" lang="en">
                {c.descriptionEn || "—"}
              </p>
            </section>
            <section className={panelClass} aria-label="Dettagli">
              <h2 className="font-medium">Dettagli</h2>
              <KeyValueList
                items={[
                  { key: "Inizio", value: c.startsAt ? formatMoment(c.startsAt) : null },
                  { key: "Fine", value: c.endsAt ? formatMoment(c.endsAt) : null },
                  { key: "Luogo", value: c.online ? `Online${c.venue ? ` · ${c.venue}` : ""}` : c.venue || null },
                  { key: "Sede", value: c.campus ? catalogueName(catalogue, "campus", c.campus) : null },
                  {
                    key: "Link",
                    value: c.link ? (
                      <a href={c.link} target="_blank" rel="noreferrer" className="break-all underline">
                        {c.link}
                      </a>
                    ) : null,
                  },
                ]}
              />
            </section>
          </div>
          <section className={panelClass} aria-label="Storico">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">Storico e commenti</h2>
              <Button variant="outline" onClick={() => setDialog({ kind: "comment" })}>
                Commenta
              </Button>
            </div>
            <ol className="space-y-3">
              {[...e.transitions].reverse().map((t) => (
                <li key={t.id} className="border-t border-(--pn-line) pt-3 text-sm">
                  <p className="font-medium">
                    {t.kind === "comment"
                      ? t.internal
                        ? "Nota interna di PoliNetwork"
                        : "Commento"
                      : t.to
                        ? eventStatusLabel[t.to]
                        : ""}
                  </p>
                  <p className="text-(--pn-fg-muted)">
                    {t.actorName} · {formatMoment(t.at)}
                  </p>
                  {t.note && <p className="whitespace-pre-wrap">{t.note}</p>}
                </li>
              ))}
            </ol>
          </section>
          {e.canWithdraw && (
            <div>
              <Button
                variant="outline"
                className="text-(--pn-danger-fg)"
                onClick={() =>
                  setDialog({
                    kind: "note",
                    title: e.status === "approved" ? "Togli l’evento dal calendario" : "Ritira l’evento",
                    description:
                      e.status === "approved"
                        ? "L’evento esce subito dal calendario del sito."
                        : "PoliNetwork non lo pubblicherà. Resterà nello storico.",
                    label: e.status === "approved" ? "Togli dal calendario" : "Ritira evento",
                    required: false,
                    danger: true,
                    action: (note) => ({ action: "withdraw", note }),
                  })
                }
              >
                {e.status === "approved" ? "Togli dal calendario" : "Ritira evento"}
              </Button>
            </div>
          )}
        </div>
      </PageContent>
      {dialog?.kind === "edit" && (
        <EventDialog
          title="Modifica l’evento"
          associationId={e.associationId}
          catalogue={catalogue}
          initial={c}
          onClose={() => setDialog(null)}
          onSave={async (content) => {
            await run({ action: "save", content }, "Bozza salvata.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "promote" && (
        <PromotionDialog
          title="Chiedi una promozione per l’evento"
          associationId={e.associationId}
          catalogue={catalogue}
          initial={prefilled}
          onClose={() => setDialog(null)}
          onSave={async (content) => {
            const { id } = await promote({ data: { associationId: e.associationId, content, commandId: promotionKey } })
            setDialog(null)
            await router.navigate({
              to: "/dashboard/associations/promotions/$promotionId",
              params: { promotionId: id },
            })
          }}
        />
      )}
      {dialog?.kind === "note" && (
        <NoteDialog
          {...dialog}
          onClose={() => setDialog(null)}
          onSubmit={async (note) => {
            await run(dialog.action(note), "Evento aggiornato.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "comment" && (
        <CommentDialog
          operator={e.operator}
          onClose={() => setDialog(null)}
          onSubmit={async (note, internal) => {
            await run({ action: "comment", note, internal }, "Commento aggiunto.")
            setDialog(null)
          }}
        />
      )}
    </>
  )
}

const queueStatuses: (EventStatus | "all")[] = ["submitted", "approved", "changes_requested", "all"]

/** Operators' event queue: proposals across associations by status and date, soonest first. */
export function EventQueue({
  events,
  filter,
}: {
  events: CalendarEvent[]
  filter: { status?: EventStatus; from?: string; to?: string }
}) {
  const router = useRouter()
  const id = useId()
  const [query, setQuery] = useState("")
  const navigate = (next: typeof filter) =>
    void router.navigate({ to: "/dashboard/associations/events", search: next, replace: true })
  const rows = events.filter((e) =>
    `${e.content.title} ${e.associationName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )
  const columns: DataTableColumn<CalendarEvent>[] = [
    {
      id: "title",
      label: "Evento",
      fill: true,
      mobile: "main",
      cell: (e) => (
        <span className="flex flex-col">
          <span className="truncate font-medium">{e.content.title || "Evento senza titolo"}</span>
          <span className="truncate text-xs text-(--pn-fg-muted)">{e.associationName}</span>
        </span>
      ),
    },
    {
      id: "date",
      label: "Inizio",
      priority: 1,
      minWidth: 170,
      cell: (e) => (e.content.startsAt ? formatMoment(e.content.startsAt) : null),
    },
    {
      id: "place",
      label: "Luogo",
      priority: 2,
      minWidth: 200,
      cell: (e) => <span className="truncate">{e.content.online ? "Online" : e.content.venue}</span>,
    },
    { id: "status", label: "Stato", mobile: "end", minWidth: 140, cell: (e) => <EventStatusBadge status={e.status} /> },
  ]
  return (
    <>
      <PageBar
        title="Eventi"
        description="Eventi proposti dalle associazioni per il calendario del sito"
        left={
          <Toolbar
            lead={
              <SegmentedControl
                label="Stato"
                value={filter.status ?? "all"}
                onValueChange={(status) => navigate({ ...filter, status: status === "all" ? undefined : status })}
                items={queueStatuses.map((value) => ({
                  value,
                  label: value === "all" ? "Tutti" : eventStatusLabel[value],
                }))}
              />
            }
            search={{ value: query, onChange: setQuery, placeholder: "Cerca per titolo o associazione…" }}
          />
        }
      />
      <PageContent width="wide">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FormField htmlFor={`${id}-from`} label="Dal">
            <DateField
              id={`${id}-from`}
              value={filter.from ?? ""}
              onChange={(from) => navigate({ ...filter, from: from || undefined })}
              locale="it"
            />
          </FormField>
          <FormField htmlFor={`${id}-to`} label="Al">
            <DateField
              id={`${id}-to`}
              value={filter.to ?? ""}
              onChange={(to) => navigate({ ...filter, to: to || undefined })}
              locale="it"
            />
          </FormField>
          {(filter.from || filter.to) && (
            <Button variant="ghost" onClick={() => navigate({ status: filter.status })}>
              Togli le date
            </Button>
          )}
        </div>
        <DataTable
          label="Eventi proposti"
          columns={columns}
          rows={rows}
          getRowId={(e) => e.id}
          rowHref={(e) => `/dashboard/associations/events/${e.id}`}
          rowLabel={(e) => `Apri ${e.content.title || "evento"}`}
          empty={
            <EmptyState
              icon={CalendarDays}
              title={events.length ? "Nessun evento corrisponde" : "Nessun evento in coda"}
              text={
                events.length
                  ? "Prova con un’altra ricerca."
                  : "Gli eventi inviati dalle associazioni compaiono qui. Cambia stato o date per vedere gli altri."
              }
            />
          }
        />
      </PageContent>
    </>
  )
}
