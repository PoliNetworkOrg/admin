import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Megaphone, Plus, Trash2 } from "lucide-react"
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
  IconButton,
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

import { creditInput, formatCredits, parseCredits } from "./portal-format"
import { reviewPortalPromotion } from "./portal-review.functions"
import { catalogueName, panelClass, parseForm, ProgrammeFields, TextField } from "./portal-ui"
import {
  type CatalogueEntry,
  type creditAccountSchema,
  estimateCost,
  POSTER_MAX_BYTES,
  type Profile,
  programmeChannels,
  type PromotionCommand,
  promotionCommandSchema,
  type PromotionContent,
  promotionContentSchema,
  isPromotionOperatorAction,
  type promotionSchema,
  type PromotionStatus,
} from "./portal.contract"
import { changePortalPromotion, createPortalPromotion, uploadPortalPoster } from "./promotion.functions"

type Promotion = z.infer<typeof promotionSchema>
type Channel = PromotionContent["channels"][number]["channel"]
type Action = PromotionCommand extends infer T
  ? T extends PromotionCommand
    ? Omit<T, "id" | "revision" | "commandId">
    : never
  : never

export const promotionStatusLabel = {
  draft: "Bozza",
  submitted: "In revisione",
  changes_requested: "Modifiche richieste",
  approved: "Approvata",
  scheduled: "Programmata",
  published: "Pubblicata",
  rejected: "Respinta",
  withdrawn: "Ritirata",
} satisfies Record<PromotionStatus, string>
const statusTone = {
  draft: "warning",
  submitted: "brand",
  changes_requested: "warning",
  approved: "success",
  scheduled: "brand",
  published: "success",
  rejected: "danger",
  withdrawn: "neutral",
} satisfies Record<PromotionStatus, StatusTone>
export const channelLabel = {
  poliassociazioni: "Canale PoliAssociazioni",
  course_broadcast: "Canale broadcast del corso",
  exam_group: "Gruppo di un esame o scaglione",
  level_group: "Gruppo generale di livello",
  course_groups: "Tutti i gruppi del corso",
  other: "Altro (lo valuta PoliNetwork)",
} satisfies Record<Channel, string>
const channels: Channel[] = [
  "poliassociazioni",
  "course_broadcast",
  "exam_group",
  "level_group",
  "course_groups",
  "other",
]
function channelHint(channel: Channel) {
  if (channel === "exam_group") return "Indica l’esame o lo scaglione."
  if (channel === "level_group") return "Indica il livello: triennale, magistrale, ciclo unico."
  if (channel === "other") return "Descrivi il canale o il caso."
  return undefined
}

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Rome",
})
const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})
/** "6 ott 2026" for an ISO day, always in Rome. */
export const formatDay = (day: string) => dayFormat.format(new Date(`${day}T12:00:00Z`))
export const formatMoment = (iso: string) => dateTimeFormat.format(new Date(iso))

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return <StatusBadge tone={statusTone[status]}>{promotionStatusLabel[status]}</StatusBadge>
}

export const EMPTY_PROMOTION: PromotionContent = {
  title: "",
  text: "",
  link: "",
  poster: null,
  channels: [{ channel: "poliassociazioni", programme: null, note: "" }],
  audience: { everyone: true, programmes: [], campuses: [] },
  desiredDate: null,
  deadline: null,
  eventId: null,
}

/** The request form: content, channels, audience and dates. Used to create and to edit a draft. */
export function PromotionDialog({
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
  initial: PromotionContent
  onClose: () => void
  onSave: (content: PromotionContent) => Promise<void>
}) {
  const id = useId()
  const upload = useServerFn(uploadPortalPoster)
  const [value, setValue] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const set = <K extends keyof PromotionContent>(key: K, next: PromotionContent[K]) =>
    setValue((current) => ({ ...current, [key]: next }))
  const programmes = catalogue.filter((e) => e.kind === "programme" && e.active)
  const setChannel = (index: number, next: Partial<PromotionContent["channels"][number]>) =>
    set(
      "channels",
      value.channels.map((c, i) => (i === index ? { ...c, ...next } : c))
    )
  // The audience reuses the profile's programme and campus picker, on a profile-shaped value.
  const audience: Profile = {
    name: "",
    acronym: "",
    descriptionIt: "",
    descriptionEn: "",
    logo: null,
    email: "",
    links: [],
    contacts: [],
    crossProgramme: false,
    programmes: value.audience.programmes,
    campuses: value.audience.campuses,
  }
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description="Collaboratori e responsabili preparano la richiesta; solo il responsabile la invia a PoliNetwork."
      noun="richiesta"
      locale="it"
      size="lg"
      dirty={JSON.stringify(value) !== JSON.stringify(initial)}
      submitLabel="Salva bozza"
      onSubmit={() => onSave(parseForm(promotionContentSchema, value))}
    >
      <TextField label="Titolo" value={value.title} onChange={(v) => set("title", v)} maxLength={200} />
      <TextField
        label="Testo del messaggio"
        value={value.text}
        onChange={(v) => set("text", v)}
        multiline
        maxLength={5000}
        hint="Il testo che PoliNetwork pubblicherà. Scrivilo come vuoi che appaia."
      />
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
          {value.poster && (
            <Button variant="ghost" onClick={() => set("poster", null)}>
              Rimuovi locandina
            </Button>
          )}
        </div>
      </FormField>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Canali richiesti</legend>
        {value.channels.map((c, index) => (
          <div key={`${id}-${index}`} className="space-y-3 rounded-lg border border-(--pn-line) p-3">
            <div className="flex items-end gap-2">
              <FormField htmlFor={`${id}-channel-${index}`} label={`Canale ${index + 1}`} className="flex-1">
                <SelectField
                  id={`${id}-channel-${index}`}
                  value={c.channel}
                  options={channels.map((value) => ({ value, label: channelLabel[value] }))}
                  onChange={(channel) =>
                    setChannel(index, { channel, programme: programmeChannels.includes(channel) ? c.programme : null })
                  }
                />
              </FormField>
              <IconButton
                icon={Trash2}
                label="Rimuovi canale"
                ariaLabel={`Rimuovi canale ${index + 1}`}
                onClick={() =>
                  set(
                    "channels",
                    value.channels.filter((_, i) => i !== index)
                  )
                }
              />
            </div>
            {programmeChannels.includes(c.channel) && (
              <FormField htmlFor={`${id}-programme-${index}`} label="Corso di studio">
                <SelectField
                  id={`${id}-programme-${index}`}
                  value={c.programme ?? ""}
                  options={[
                    { value: "", label: "Scegli un corso" },
                    ...programmes.map((e) => ({ value: e.slug, label: e.nameIt })),
                  ]}
                  onChange={(programme) => setChannel(index, { programme: programme || null })}
                />
              </FormField>
            )}
            {(channelHint(c.channel) || c.note) && (
              <TextField
                label="Dettagli"
                value={c.note}
                onChange={(note) => setChannel(index, { note })}
                maxLength={300}
                hint={channelHint(c.channel)}
              />
            )}
          </div>
        ))}
        <Button
          variant="outline"
          disabled={value.channels.length >= 12}
          onClick={() =>
            set("channels", [...value.channels, { channel: "poliassociazioni", programme: null, note: "" }])
          }
        >
          <Plus aria-hidden /> Aggiungi canale
        </Button>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Pubblico</legend>
        <label className="flex items-start gap-2.5 text-[14px]">
          <Checkbox
            checked={value.audience.everyone}
            onCheckedChange={(checked) => set("audience", { everyone: checked === true, programmes: [], campuses: [] })}
            className={checkboxControl}
          />
          <span className="font-medium">Tutti gli studenti</span>
        </label>
        {!value.audience.everyone && (
          <ProgrammeFields
            value={audience}
            catalogue={catalogue}
            hideCrossProgramme
            onChange={(next) =>
              set("audience", { everyone: false, programmes: next.programmes, campuses: next.campuses })
            }
          />
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor={`${id}-desired`} label="Data desiderata">
          <DateField
            id={`${id}-desired`}
            value={value.desiredDate ?? ""}
            onChange={(day) => set("desiredDate", day || null)}
            locale="it"
            pastYears={0}
            futureYears={1}
          />
        </FormField>
        <FormField
          htmlFor={`${id}-deadline`}
          label="Scadenza (facoltativa)"
          hint="Ad esempio la chiusura delle iscrizioni."
        >
          <DateField
            id={`${id}-deadline`}
            value={value.deadline ?? ""}
            onChange={(day) => set("deadline", day || null)}
            locale="it"
            pastYears={0}
            futureYears={1}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/** The association's requests, newest first, in its Promozioni tab. */
export function PromotionsTab({
  associationId,
  promotions,
  catalogue,
  canCreate,
}: {
  associationId: string
  promotions: Promotion[]
  catalogue: CatalogueEntry[]
  canCreate: boolean
}) {
  const router = useRouter()
  const create = useServerFn(createPortalPromotion)
  const [creating, setCreating] = useState(false)
  const [commandId, setCommandId] = useState(() => crypto.randomUUID())
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Richieste di promozione</h2>
        {canCreate && (
          <Button
            onClick={() => {
              setCommandId(crypto.randomUUID())
              setCreating(true)
            }}
          >
            Nuova richiesta
          </Button>
        )}
      </div>
      <p className="text-sm text-(--pn-fg-muted)">
        Chiedi a PoliNetwork di promuovere un evento, un annuncio o un bando sui suoi canali.
      </p>
      {promotions.length === 0 ? (
        <p className="text-sm text-(--pn-fg-muted)">Non ci sono richieste.</p>
      ) : (
        <ul className="divide-y divide-(--pn-line)">
          {[...promotions].reverse().map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  to="/dashboard/associations/promotions/$promotionId"
                  params={{ promotionId: p.id }}
                  className="font-medium underline"
                >
                  {p.content.title || "Richiesta senza titolo"}
                </Link>
                <p className="text-sm text-(--pn-fg-muted)">
                  {p.scheduledAt
                    ? `Programmata per il ${formatMoment(p.scheduledAt)}`
                    : p.content.desiredDate
                      ? `Data desiderata ${formatDay(p.content.desiredDate)}`
                      : "Data da scegliere"}{" "}
                  · {p.createdByName}
                </p>
              </div>
              <PromotionStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <PromotionDialog
          title="Nuova richiesta di promozione"
          associationId={associationId}
          catalogue={catalogue}
          initial={EMPTY_PROMOTION}
          onClose={() => setCreating(false)}
          onSave={async (content) => {
            const { id } = await create({ data: { associationId, content, commandId } })
            setCreating(false)
            await router.navigate({
              to: "/dashboard/associations/promotions/$promotionId",
              params: { promotionId: id },
            })
          }}
        />
      )}
    </section>
  )
}

type Dialog =
  | { kind: "edit" }
  | {
      kind: "note"
      title: string
      description: string
      label: string
      required: boolean
      danger?: boolean
      action: (note: string) => Action
    }
  | { kind: "comment" }
  | { kind: "schedule" }
  | { kind: "publish" }
  | { kind: "approve" }

/** One request: what was asked, where it stands, its history, and the actions open to this viewer. */
export function PromotionPage({
  promotion: p,
  catalogue,
  credits,
}: {
  promotion: Promotion
  catalogue: CatalogueEntry[]
  credits: z.infer<typeof creditAccountSchema> | null
}) {
  const router = useRouter()
  const change = useServerFn(changePortalPromotion)
  const review = useServerFn(reviewPortalPromotion)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  async function run(action: Action, message: string) {
    const data = parseForm(promotionCommandSchema, {
      ...action,
      id: p.id,
      revision: p.revision,
      commandId: crypto.randomUUID(),
    })
    if (isPromotionOperatorAction(action.action) || (action.action === "comment" && p.operator)) await review({ data })
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
  const c = p.content
  const programmeName = (slug: string) => catalogueName(catalogue, "programme", slug)
  const audience = c.audience.everyone
    ? "Tutti gli studenti"
    : [
        ...c.audience.programmes.map(programmeName),
        ...c.audience.campuses.map((s) => catalogueName(catalogue, "campus", s)),
      ].join(", ")
  const open = ["submitted", "approved", "scheduled"].includes(p.status)
  return (
    <>
      <PageBar
        back={
          p.operator
            ? { label: "Promozioni", link: { to: "/dashboard/associations/promotions" } }
            : { label: p.associationName, link: { to: "/dashboard/associations/$id", params: { id: p.associationId } } }
        }
        crumb={p.associationName}
        context="Richiesta di promozione"
      />
      <PageContent width="record">
        <div className="space-y-6">
          <RecordHeader
            title={c.title || "Richiesta senza titolo"}
            badge={<PromotionStatusBadge status={p.status} />}
            meta={`${p.associationName} · preparata da ${p.createdByName}`}
            actions={
              <>
                {p.canEdit && <Button onClick={() => setDialog({ kind: "edit" })}>Modifica</Button>}
                {p.canSubmit && (
                  <ConfirmDialog
                    title="Inviare la richiesta a PoliNetwork?"
                    description="Non potrai modificarla mentre è in revisione."
                    confirmLabel="Invia richiesta"
                    cancelLabel="Annulla"
                    tone="primary"
                    onConfirm={() => run({ action: "submit" }, "Richiesta inviata.")}
                    trigger={<Button variant={p.canEdit ? "outline" : "default"}>Invia a PoliNetwork</Button>}
                  />
                )}
              </>
            }
          />
          {credits?.enabled && (p.canSubmit || p.status === "submitted") && (
            <CostNotice promotion={p} credits={credits} />
          )}
          {p.status === "changes_requested" && !p.operator && (
            <InlineAlert tone="warning">
              PoliNetwork ha chiesto delle modifiche: le trovi nello storico. Aggiorna la richiesta e inviala di nuovo.
            </InlineAlert>
          )}
          {p.operator && p.status === "submitted" && (
            <section className={panelClass} aria-label="Decisione">
              <h2 className="font-medium">Decisione di PoliNetwork</h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDialog({ kind: "approve" })}>Approva</Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setDialog({
                      kind: "note",
                      title: "Chiedi modifiche",
                      description: "Il responsabile riceve la tua nota e può aggiornare la richiesta.",
                      label: "Chiedi modifiche",
                      required: true,
                      action: (note) => ({ action: "changes", note }),
                    })
                  }
                >
                  Chiedi modifiche
                </Button>
                <RejectButton onReject={() => setDialog(rejectDialog)} />
              </div>
            </section>
          )}
          {p.operator && (p.status === "approved" || p.status === "scheduled") && (
            <section className={panelClass} aria-label="Pubblicazione">
              <h2 className="font-medium">Pubblicazione</h2>
              <p className="text-sm text-(--pn-fg-muted)">
                La pubblicazione sui canali resta manuale: programma la data, poi segna la richiesta come pubblicata.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDialog({ kind: "schedule" })}>
                  {p.status === "scheduled" ? "Cambia programmazione" : "Programma"}
                </Button>
                <Button variant="outline" onClick={() => setDialog({ kind: "publish" })}>
                  Segna come pubblicata
                </Button>
                <RejectButton onReject={() => setDialog(rejectDialog)} />
              </div>
            </section>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
            <section className={panelClass} aria-label="Contenuto">
              <h2 className="font-medium">Contenuto</h2>
              {c.poster && (
                <img
                  src={c.poster}
                  alt="Locandina"
                  referrerPolicy="no-referrer"
                  className="max-h-64 rounded-lg object-contain"
                />
              )}
              <p className="whitespace-pre-wrap text-sm">{c.text || "—"}</p>
              {c.link && (
                <a
                  href={c.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm break-all text-(--pn-accent) underline"
                >
                  {c.link}
                </a>
              )}
            </section>
            <section className={panelClass} aria-label="Dettagli">
              <h2 className="font-medium">Dettagli</h2>
              <KeyValueList
                items={[
                  {
                    key: "Canali",
                    value: (
                      <ul className="space-y-1">
                        {c.channels.map((ch, i) => (
                          <li key={`${ch.channel}-${i}`}>
                            {channelLabel[ch.channel]}
                            {ch.programme ? ` · ${programmeName(ch.programme)}` : ""}
                            {ch.note ? ` · ${ch.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  { key: "Pubblico", value: audience || null },
                  { key: "Data desiderata", value: c.desiredDate ? formatDay(c.desiredDate) : null },
                  { key: "Scadenza", value: c.deadline ? formatDay(c.deadline) : null },
                  ...(p.scheduledAt
                    ? [
                        {
                          key: "Programmata",
                          value: `${formatMoment(p.scheduledAt)} · ${p.scheduledChannel ? channelLabel[p.scheduledChannel] : ""}${p.scheduledDetail ? ` · ${p.scheduledDetail}` : ""}`,
                        },
                      ]
                    : []),
                  ...(p.publishedUrl
                    ? [
                        {
                          key: "Pubblicata",
                          value: (
                            <a href={p.publishedUrl} target="_blank" rel="noreferrer" className="break-all underline">
                              {p.publishedUrl}
                            </a>
                          ),
                        },
                      ]
                    : []),
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
              {[...p.transitions].reverse().map((t) => (
                <li key={t.id} className="border-t border-(--pn-line) pt-3 text-sm">
                  <p className="font-medium">
                    {t.kind === "comment"
                      ? t.internal
                        ? "Nota interna di PoliNetwork"
                        : "Commento"
                      : t.to
                        ? promotionStatusLabel[t.to]
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
          {p.canWithdraw && (
            <div>
              <Button
                variant="outline"
                className="text-(--pn-danger-fg)"
                onClick={() =>
                  setDialog({
                    kind: "note",
                    title: "Ritira la richiesta",
                    description: open
                      ? "PoliNetwork non la pubblicherà. Per riproporla servirà una nuova richiesta."
                      : "La bozza resterà nello storico.",
                    label: "Ritira richiesta",
                    required: false,
                    danger: true,
                    action: (note) => ({ action: "withdraw", note }),
                  })
                }
              >
                Ritira richiesta
              </Button>
            </div>
          )}
        </div>
      </PageContent>
      {dialog?.kind === "edit" && (
        <PromotionDialog
          title="Modifica la richiesta"
          associationId={p.associationId}
          catalogue={catalogue}
          initial={c}
          onClose={() => setDialog(null)}
          onSave={async (content) => {
            await run({ action: "save", content }, "Bozza salvata.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "note" && (
        <NoteDialog
          {...dialog}
          onClose={() => setDialog(null)}
          onSubmit={async (note) => {
            await run(dialog.action(note), "Richiesta aggiornata.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "comment" && (
        <CommentDialog
          operator={p.operator}
          onClose={() => setDialog(null)}
          onSubmit={async (note, internal) => {
            await run({ action: "comment", note, internal }, "Commento aggiunto.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "schedule" && (
        <ScheduleDialog
          promotion={p}
          onClose={() => setDialog(null)}
          onSubmit={async (action) => {
            await run(action, "Richiesta programmata.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "approve" && (
        <ApproveDialog
          promotion={p}
          credits={credits}
          onClose={() => setDialog(null)}
          onSubmit={async (note, cost) => {
            await run({ action: "approve", note, cost }, "Richiesta approvata.")
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === "publish" && (
        <NoteDialog
          title="Segna come pubblicata"
          description="Incolla il link al messaggio o al post pubblicato."
          label="Segna come pubblicata"
          required={false}
          urlLabel="Link alla pubblicazione"
          onClose={() => setDialog(null)}
          onSubmit={async (note, url) => {
            await run({ action: "publish", url: url ?? "", note }, "Richiesta segnata come pubblicata.")
            setDialog(null)
          }}
        />
      )}
    </>
  )
  function RejectButton({ onReject }: { onReject: () => void }) {
    return (
      <Button variant="ghost" className="text-(--pn-danger-fg)" onClick={onReject}>
        Respingi
      </Button>
    )
  }
}
const rejectDialog: Dialog = {
  kind: "note",
  title: "Respingi la richiesta",
  description: "La richiesta si chiude. Il responsabile riceve la motivazione.",
  label: "Respingi",
  required: true,
  danger: true,
  action: (note) => ({ action: "reject", note }),
}

export function NoteDialog({
  title,
  description,
  label,
  required,
  danger,
  urlLabel,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  label: string
  required: boolean
  danger?: boolean
  urlLabel?: string
  onClose: () => void
  onSubmit: (note: string, url?: string) => Promise<void>
}) {
  const [note, setNote] = useState("")
  const [url, setUrl] = useState("")
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description={description}
      noun="richiesta"
      locale="it"
      dirty={!!note || !!url}
      submitLabel={label}
      tone={danger ? "danger" : undefined}
      canSubmit={(!required || !!note.trim()) && (!urlLabel || !!url.trim())}
      onSubmit={() => onSubmit(note, urlLabel ? url : undefined)}
    >
      {urlLabel && <TextField label={urlLabel} type="url" value={url} onChange={setUrl} maxLength={2048} />}
      <TextField
        label={required ? "Nota" : "Nota (facoltativa)"}
        value={note}
        onChange={setNote}
        multiline
        maxLength={4000}
      />
    </FormDialog>
  )
}

export function CommentDialog({
  operator,
  onClose,
  onSubmit,
}: {
  operator: boolean
  onClose: () => void
  onSubmit: (note: string, internal: boolean) => Promise<void>
}) {
  const [note, setNote] = useState("")
  const [internal, setInternal] = useState(false)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Commenta la richiesta"
      description={
        operator
          ? "Il commento è visibile ai referenti e arriva per email, salvo le note interne."
          : "Il commento è visibile a PoliNetwork e agli altri referenti."
      }
      noun="commento"
      locale="it"
      dirty={!!note}
      submitLabel="Aggiungi commento"
      canSubmit={!!note.trim()}
      onSubmit={() => onSubmit(note, operator && internal)}
    >
      <TextField label="Commento" value={note} onChange={setNote} multiline maxLength={4000} />
      {operator && (
        <label className="flex items-start gap-2.5 text-[14px]">
          <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} className={checkboxControl} />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Nota interna</span>
            <span className="text-[13px] text-(--pn-fg-muted)">Visibile solo agli operatori PoliNetwork.</span>
          </span>
        </label>
      )}
    </FormDialog>
  )
}

function ScheduleDialog({
  promotion: p,
  onClose,
  onSubmit,
}: {
  promotion: Promotion
  onClose: () => void
  onSubmit: (action: Action) => Promise<void>
}) {
  const id = useId()
  const [day, setDay] = useState(p.scheduledAt?.slice(0, 10) ?? p.content.desiredDate ?? "")
  const [time, setTime] = useState("10:00")
  const [channel, setChannel] = useState<Channel>(
    p.scheduledChannel ?? p.content.channels[0]?.channel ?? "poliassociazioni"
  )
  const [detail, setDetail] = useState(p.scheduledDetail)
  const [note, setNote] = useState("")
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Programma la pubblicazione"
      description="Data e canale effettivi: il responsabile riceve un’email."
      noun="programmazione"
      locale="it"
      dirty
      submitLabel="Programma"
      canSubmit={!!day && /^\d{2}:\d{2}$/.test(time)}
      onSubmit={() =>
        onSubmit({
          action: "schedule",
          scheduledAt: new Date(`${day}T${time}`).toISOString(),
          channel,
          detail,
          note,
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor={`${id}-day`} label="Data">
          <DateField id={`${id}-day`} value={day} onChange={setDay} locale="it" pastYears={0} futureYears={1} />
        </FormField>
        <FormField htmlFor={`${id}-time`} label="Ora">
          <Input
            id={`${id}-time`}
            type="time"
            className={fieldControl}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </FormField>
      </div>
      <FormField htmlFor={`${id}-channel`} label="Canale">
        <SelectField
          id={`${id}-channel`}
          value={channel}
          options={channels.map((value) => ({ value, label: channelLabel[value] }))}
          onChange={setChannel}
        />
      </FormField>
      <TextField label="Dettagli (facoltativi)" value={detail} onChange={setDetail} maxLength={300} />
      <TextField label="Nota (facoltativa)" value={note} onChange={setNote} multiline maxLength={4000} />
    </FormDialog>
  )
}

const queueStatuses: (PromotionStatus | "all")[] = ["submitted", "approved", "scheduled", "changes_requested", "all"]

/** Operators' queue: requests across associations by status and date, most urgent first. */
export function PromotionQueue({
  promotions,
  filter,
}: {
  promotions: Promotion[]
  filter: { status?: PromotionStatus; from?: string; to?: string }
}) {
  const router = useRouter()
  const id = useId()
  const [query, setQuery] = useState("")
  const navigate = (next: typeof filter) =>
    void router.navigate({ to: "/dashboard/associations/promotions", search: next, replace: true })
  const rows = promotions.filter((p) =>
    `${p.content.title} ${p.associationName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )
  const columns: DataTableColumn<Promotion>[] = [
    {
      id: "title",
      label: "Richiesta",
      fill: true,
      mobile: "main",
      cell: (p) => (
        <span className="flex flex-col">
          <span className="truncate font-medium">{p.content.title || "Richiesta senza titolo"}</span>
          <span className="truncate text-xs text-(--pn-fg-muted)">{p.associationName}</span>
        </span>
      ),
    },
    {
      id: "date",
      label: "Data",
      priority: 1,
      minWidth: 170,
      cell: (p) =>
        p.scheduledAt ? formatMoment(p.scheduledAt) : p.content.desiredDate ? formatDay(p.content.desiredDate) : null,
    },
    {
      id: "channels",
      label: "Canali",
      priority: 2,
      minWidth: 220,
      cell: (p) => (
        <span className="truncate">{p.content.channels.map((c) => channelLabel[c.channel]).join(", ")}</span>
      ),
    },
    {
      id: "status",
      label: "Stato",
      mobile: "end",
      minWidth: 140,
      cell: (p) => <PromotionStatusBadge status={p.status} />,
    },
  ]
  return (
    <>
      <PageBar
        title="Promozioni"
        description="Richieste di promozione delle associazioni, dalla revisione alla pubblicazione"
        left={
          <Toolbar
            lead={
              <SegmentedControl
                label="Stato"
                value={filter.status ?? "all"}
                onValueChange={(status) => navigate({ ...filter, status: status === "all" ? undefined : status })}
                items={queueStatuses.map((value) => ({
                  value,
                  label: value === "all" ? "Tutte" : promotionStatusLabel[value],
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
          label="Richieste di promozione"
          columns={columns}
          rows={rows}
          getRowId={(p) => p.id}
          rowHref={(p) => `/dashboard/associations/promotions/${p.id}`}
          rowLabel={(p) => `Apri ${p.content.title || "richiesta"}`}
          empty={
            <EmptyState
              icon={Megaphone}
              title={promotions.length ? "Nessuna richiesta corrisponde" : "Nessuna richiesta in coda"}
              text={
                promotions.length
                  ? "Prova con un’altra ricerca."
                  : "Le richieste inviate dalle associazioni compaiono qui. Cambia stato o date per vedere le altre."
              }
            />
          }
        />
      </PageContent>
    </>
  )
}

/** The request's estimated cost against the balance, shown before submitting and while it waits for a decision. */
function CostNotice({ promotion: p, credits }: { promotion: Promotion; credits: z.infer<typeof creditAccountSchema> }) {
  const estimate = estimateCost(p.content.channels, credits.programmes, credits.config)
  const text = `Costo stimato: ${formatCredits(estimate.total)}${estimate.unknown ? " più i canali che PoliNetwork valuta caso per caso" : ""}. Saldo: ${formatCredits(credits.balance)}.`
  const short = !credits.config.allowNegative && estimate.total > credits.balance
  return (
    <InlineAlert tone={short ? "warning" : "info"}>
      {text} I crediti si scalano all’approvazione e tornano se la richiesta viene respinta o ritirata.
      {short && " Il saldo non basta: PoliNetwork non potrà approvarla così."}
    </InlineAlert>
  )
}

/** Approval, with the cost to debit when credits are on: the estimate, or a price for channels without one. */
function ApproveDialog({
  promotion: p,
  credits,
  onClose,
  onSubmit,
}: {
  promotion: Promotion
  credits: z.infer<typeof creditAccountSchema> | null
  onClose: () => void
  onSubmit: (note: string, cost: number | null) => Promise<void>
}) {
  const estimate = credits?.enabled ? estimateCost(p.content.channels, credits.programmes, credits.config) : null
  const [note, setNote] = useState("")
  const [cost, setCost] = useState(estimate && !estimate.unknown ? creditInput(estimate.total) : "")
  const parsed = parseCredits(cost)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Approva la richiesta"
      description={
        estimate
          ? `L’approvazione scala i crediti dall’associazione (saldo ${formatCredits(credits?.balance ?? 0)}). Poi potrai programmarla.`
          : "Dopo l’approvazione potrai programmarla con data e canale effettivi."
      }
      noun="richiesta"
      locale="it"
      dirty={!!note}
      submitLabel="Approva"
      canSubmit={!estimate || (parsed !== null && parsed >= 0)}
      onSubmit={() => onSubmit(note, estimate && (estimate.unknown || parsed !== estimate.total) ? parsed : null)}
    >
      {estimate && (
        <TextField
          label="Crediti da scalare"
          value={cost}
          onChange={setCost}
          maxLength={10}
          hint={
            estimate.unknown
              ? `Stima per i canali con costo fisso: ${formatCredits(estimate.total)}. Aggiungi il costo dei canali “Altro”.`
              : `Stima secondo le regole: ${formatCredits(estimate.total)}.`
          }
        />
      )}
      <TextField label="Nota (facoltativa)" value={note} onChange={setNote} multiline maxLength={4000} />
    </FormDialog>
  )
}
