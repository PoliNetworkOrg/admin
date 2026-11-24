import { useServerFn } from "@tanstack/react-start"
import { X } from "lucide-react"
import { useId, useState } from "react"
import type { z } from "zod"

import {
  checkboxControl,
  Chip,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  FileButton,
  FormDialog,
  FormField,
  SelectField,
  fieldControl,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { type CatalogueEntry, type Contact, LOGO_MAX_BYTES, type Profile } from "./portal.contract"
import { uploadPortalLogo } from "./portal.functions"

export const EMPTY_PROFILE: Profile = {
  name: "",
  acronym: "",
  descriptionIt: "",
  descriptionEn: "",
  email: "",
  logo: null,
  links: [],
  programmes: [],
  campuses: [],
  crossProgramme: false,
  contacts: [],
}
export const contactFunctionLabel = {
  presidency: "Presidenza",
  events: "Eventi",
  collaborations: "Collaborazioni",
  communications: "Comunicazione",
  other: "Altro",
} satisfies Record<Contact["function"], string>
export const visibilityLabel = {
  public: "Pubblico",
  associations: "Altre associazioni",
  polinetwork: "Solo PoliNetwork",
} satisfies Record<Contact["visibility"], string>
export const visibilityDescription = {
  public: "Sul sito dopo l’approvazione di PoliNetwork, come il resto della scheda.",
  associations: "Visibile ai referenti delle altre associazioni attive nel portale.",
  polinetwork: "Visibile solo ai referenti di questa associazione e a PoliNetwork.",
} satisfies Record<Contact["visibility"], string>
/** The catalogue name of a programme or campus; a slug no longer in the catalogue is shown as is. */
export function catalogueName(catalogue: CatalogueEntry[], kind: CatalogueEntry["kind"], slug: string) {
  return catalogue.find((e) => e.kind === kind && e.slug === slug)?.nameIt ?? slug
}
export const roleOptions = [
  { value: "responsible", label: "Responsabile" },
  { value: "collaborator", label: "Collaboratore" },
] as const
export const statusLabel = {
  pending: "Da registrare",
  active: "Attiva",
  suspended: "Sospesa",
  archived: "Archiviata",
  draft: "Bozza",
  submitted: "In revisione",
  changes: "Integrazioni richieste",
  approved: "Approvata",
  rejected: "Rifiutata",
  withdrawn: "Ritirata",
  registration: "Registrazione",
  access: "Accesso",
  membership: "Referenti",
  content: "Scheda pubblica",
  responsible: "Responsabile",
  collaborator: "Collaboratore",
}
export const platformLabel = {
  website: "Sito web",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  spotify: "Spotify",
  twitch: "Twitch",
  other: "Altro",
} satisfies Record<Profile["links"][number]["platform"], string>
type Platform = Profile["links"][number]["platform"]
// SAFETY: `platformLabel` satisfies Record<Platform, string>, so its keys are exactly the contract's platforms.
const platforms = Object.keys(platformLabel) as Platform[]

/** Drops link rows the user added but left empty, so they don't fail validation. */
export function cleanProfile(profile: Profile): Profile {
  return { ...profile, links: profile.links.filter((link) => link.label.trim() || link.url.trim()) }
}

const fieldLabel = new Map([
  ["name", "Nome ufficiale"],
  ["acronym", "Acronimo"],
  ["descriptionIt", "Descrizione italiana"],
  ["descriptionEn", "Descrizione inglese"],
  ["email", "Email"],
  ["logo", "URL del logo"],
  ["label", "Etichetta"],
  ["url", "Indirizzo"],
  ["platform", "Piattaforma"],
  ["explanation", "Motivazione"],
  ["reason", "Motivazione"],
  ["note", "Note"],
  ["token", "Invito"],
  ["phone", "Telefono"],
  ["programmes", "Corsi di studio"],
  ["campuses", "Sedi"],
])

/** Parses user input and throws an Italian message naming the field, never the raw Zod issue list. */
export function parseForm<T extends z.ZodType>(schema: T, value: z.input<T>): z.output<T> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const path = issue?.path ?? []
  const linkAt = path.indexOf("links")
  const linkIndex = linkAt >= 0 ? Number(path[linkAt + 1]) : Number.NaN
  const key = String(path.at(-1) ?? "")
  const label = fieldLabel.get(key)
  const where = Number.isInteger(linkIndex)
    ? `Collegamento ${linkIndex + 1}${label ? ` · ${label}` : ""}`
    : (label ?? "Dati inseriti")
  const problem =
    issue?.code === "too_big"
      ? "è troppo lungo"
      : issue?.code === "too_small"
        ? "è obbligatorio"
        : key === "email"
          ? "non è un indirizzo email valido"
          : key === "url" || key === "logo"
            ? "deve essere un indirizzo HTTP o HTTPS valido"
            : "non è valido"
  throw new Error(`${where} ${problem}.`)
}

export const panelClass = "rounded-xl border border-(--pn-line) bg-(--pn-surface) p-5 space-y-4"

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  type = "text",
  maxLength = 20000,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  hint?: string
  type?: string
  maxLength?: number
}) {
  const id = useId()
  return (
    <FormField htmlFor={id} label={label} hint={hint}>
      {multiline ? (
        <Textarea
          id={id}
          className={fieldControl}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-description` : undefined}
        />
      ) : (
        <Input
          id={id}
          type={type}
          className={fieldControl}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-description` : undefined}
        />
      )}
    </FormField>
  )
}

/** Programmes (searchable, as chips) and campuses (checkboxes), or the cross-programme flag. */
export function ProgrammeFields({
  value,
  onChange,
  catalogue,
  hideCrossProgramme = false,
}: {
  value: Profile
  onChange: (value: Profile) => void
  catalogue: CatalogueEntry[]
  /** For audiences: "everyone" is chosen elsewhere. */
  hideCrossProgramme?: boolean
}) {
  const id = useId()
  const [search, setSearch] = useState("")
  // Retired entries stay listed on a record that already has them, but cannot be added.
  const programmes = catalogue.filter((e) => e.kind === "programme" && e.active)
  const campuses = catalogue.filter((e) => e.kind === "campus" && (e.active || value.campuses.includes(e.slug)))
  return (
    <fieldset className="space-y-4">
      <legend className={hideCrossProgramme ? "sr-only" : "text-sm font-medium"}>Corsi di studio e sedi</legend>
      {!hideCrossProgramme && (
        <label className="flex items-start gap-2.5 text-[14px]">
          <Checkbox
            checked={value.crossProgramme}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                crossProgramme: checked === true,
                programmes: checked === true ? [] : value.programmes,
              })
            }
            className={checkboxControl}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Trasversale a tutti i corsi</span>
            <span className="text-[13px] text-(--pn-fg-muted)">
              L’associazione si rivolge a studenti di qualsiasi corso di studio.
            </span>
          </span>
        </label>
      )}
      {!value.crossProgramme && (
        <FormField htmlFor={`${id}-programme`} label="Corsi di studio" hint="Scegli dal catalogo di PoliNetwork.">
          <div className="space-y-2">
            {value.programmes.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Corsi scelti">
                {value.programmes.map((slug) => (
                  <li key={slug}>
                    <Chip className="h-8 pr-1">
                      {catalogueName(catalogue, "programme", slug)}
                      <button
                        type="button"
                        className="relative grid size-7 place-items-center rounded-(--pn-r-full) after:absolute after:-inset-1 hover:bg-(--pn-hover)"
                        aria-label={`Rimuovi ${catalogueName(catalogue, "programme", slug)}`}
                        onClick={() => onChange({ ...value, programmes: value.programmes.filter((p) => p !== slug) })}
                      >
                        <X aria-hidden className="size-3.5" />
                      </button>
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            <Combobox
              multiple
              items={programmes}
              value={programmes.filter((e) => value.programmes.includes(e.slug))}
              inputValue={search}
              onInputValueChange={setSearch}
              onValueChange={(entries: CatalogueEntry[]) => {
                // Keep retired programmes the record already lists: they are not in `items`.
                const kept = value.programmes.filter((slug) => !programmes.some((e) => e.slug === slug))
                onChange({ ...value, programmes: [...kept, ...entries.map((e) => e.slug)] })
                setSearch("")
              }}
              itemToStringLabel={(entry: CatalogueEntry) => entry.nameIt}
              itemToStringValue={(entry: CatalogueEntry) => entry.slug}
            >
              <ComboboxInput id={`${id}-programme`} listLabel="corsi" placeholder="Cerca un corso…" />
              <ComboboxContent>
                <ComboboxEmpty>Nessun corso corrisponde.</ComboboxEmpty>
                <ComboboxList>
                  {(entry: CatalogueEntry) => (
                    <ComboboxItem key={entry.slug} value={entry}>
                      {entry.nameIt}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </FormField>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm">Sedi</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {campuses.map((campus) => (
            <label key={campus.slug} className="flex items-center gap-2.5 text-[14px]">
              <Checkbox
                checked={value.campuses.includes(campus.slug)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    campuses:
                      checked === true
                        ? [...value.campuses, campus.slug]
                        : value.campuses.filter((c) => c !== campus.slug),
                  })
                }
                className={checkboxControl}
              />
              {campus.nameIt}
            </label>
          ))}
        </div>
      </fieldset>
    </fieldset>
  )
}

export function ProfileFields({
  value,
  onChange,
  associationId,
  catalogue,
}: {
  value: Profile
  onChange: (value: Profile) => void
  associationId?: string
  catalogue: CatalogueEntry[]
}) {
  const upload = useServerFn(uploadPortalLogo)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const prefix = useId()
  const set = (key: keyof Profile, next: string | null) => onChange({ ...value, [key]: next })
  return (
    <div className="space-y-4">
      <p className="text-sm text-(--pn-fg-muted)">
        Questi dati saranno pubblici solo dopo l’approvazione della scheda.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome ufficiale" value={value.name} onChange={(v) => set("name", v)} maxLength={200} />
        <TextField
          label="Acronimo (facoltativo)"
          value={value.acronym}
          onChange={(v) => set("acronym", v)}
          maxLength={50}
        />
      </div>
      <TextField
        label="Descrizione italiana"
        value={value.descriptionIt}
        multiline
        onChange={(v) => set("descriptionIt", v)}
      />
      <TextField
        label="Descrizione inglese"
        value={value.descriptionEn}
        multiline
        onChange={(v) => set("descriptionEn", v)}
        hint="Puoi completarla dopo la registrazione, prima di chiedere la pubblicazione."
      />
      <ProgrammeFields value={value} onChange={onChange} catalogue={catalogue} />
      <TextField
        label="Email pubblica dell’associazione"
        value={value.email}
        type="email"
        onChange={(v) => set("email", v)}
      />
      {associationId && (
        <FormField
          htmlFor={`${prefix}-logo`}
          label="Carica logo"
          hint="PNG o JPEG, massimo 1 MB. Il caricamento non pubblica la scheda."
          error={uploadError}
        >
          <FileButton
            id={`${prefix}-logo`}
            file={null}
            accept="image/png,image/jpeg"
            label={uploading ? "Caricamento…" : "Scegli un file"}
            invalid={!!uploadError}
            onChange={async (file) => {
              if (!file || uploading) return
              setUploadError("")
              setUploading(true)
              try {
                if (file.size > LOGO_MAX_BYTES) throw new Error("Il logo non può superare 1 MB")
                const data = new FormData()
                data.set("id", associationId)
                data.set("file", file)
                const result = await upload({ data })
                onChange({ ...value, logo: result.url })
              } catch (error) {
                console.error(error)
                setUploadError(error instanceof Error ? error.message : "Caricamento non riuscito")
              } finally {
                setUploading(false)
              }
            }}
          />
        </FormField>
      )}
      <TextField
        label="URL del logo (facoltativo)"
        value={value.logo ?? ""}
        type="url"
        onChange={(v) => set("logo", v || null)}
        hint="Indirizzo HTTP o HTTPS del logo dell’associazione."
      />
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Sito, social e canali</h3>
        {value.links.map((link, index) => (
          <fieldset key={`${prefix}-${index}`} className="space-y-3 rounded-lg border border-(--pn-line) p-3">
            <legend className="px-1 text-sm">Collegamento {index + 1}</legend>
            <FormField htmlFor={`${prefix}-${index}`} label="Piattaforma">
              <SelectField
                id={`${prefix}-${index}`}
                value={link.platform}
                options={platforms.map((platform) => ({ value: platform, label: platformLabel[platform] }))}
                onChange={(v) =>
                  onChange({
                    ...value,
                    links: value.links.map((l, i) => (i === index ? { ...l, platform: v } : l)),
                  })
                }
              />
            </FormField>
            <TextField
              label="Etichetta"
              value={link.label}
              onChange={(v) =>
                onChange({ ...value, links: value.links.map((l, i) => (i === index ? { ...l, label: v } : l)) })
              }
              maxLength={100}
            />
            <TextField
              label="Indirizzo"
              value={link.url}
              type="url"
              onChange={(v) =>
                onChange({ ...value, links: value.links.map((l, i) => (i === index ? { ...l, url: v } : l)) })
              }
              maxLength={2048}
            />
            <Button
              variant="ghost"
              onClick={() => onChange({ ...value, links: value.links.filter((_, i) => i !== index) })}
            >
              Rimuovi collegamento {index + 1}
            </Button>
          </fieldset>
        ))}
        <Button
          variant="outline"
          disabled={value.links.length >= 30}
          onClick={() => onChange({ ...value, links: [...value.links, { platform: "website", label: "", url: "" }] })}
        >
          Aggiungi collegamento
        </Button>
      </div>
    </div>
  )
}

export function ProfilePreview({ profile, catalogue }: { profile: Profile | null; catalogue: CatalogueEntry[] }) {
  if (!profile) return <p className="text-sm text-(--pn-fg-muted)">Nessuna versione pubblicata.</p>
  const programmes = profile.crossProgramme
    ? ["Trasversale a tutti i corsi"]
    : profile.programmes.map((slug) => catalogueName(catalogue, "programme", slug))
  const campuses = profile.campuses.map((slug) => catalogueName(catalogue, "campus", slug))
  return (
    <div className="space-y-3 break-words">
      {profile.logo && (
        <img src={profile.logo} alt="" referrerPolicy="no-referrer" className="size-16 rounded-lg object-contain" />
      )}
      <h3 className="font-semibold">
        {profile.name}
        {profile.acronym ? ` (${profile.acronym})` : ""}
      </h3>
      <p className="whitespace-pre-wrap text-sm">{profile.descriptionIt}</p>
      <p className="whitespace-pre-wrap text-sm text-(--pn-fg-muted)" lang="en">
        {profile.descriptionEn}
      </p>
      {(programmes.length > 0 || campuses.length > 0) && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Corsi e sedi">
          {[...programmes, ...campuses].map((name) => (
            <li key={name}>
              <Chip>{name}</Chip>
            </li>
          ))}
        </ul>
      )}
      {profile.email && <p className="text-sm">{profile.email}</p>}
      {profile.contacts.length > 0 && (
        <ul className="space-y-1 text-sm">
          {profile.contacts.map((c) => (
            <li key={c.id}>
              <span className="text-(--pn-fg-muted)">{c.label}:</span> {c.email}
              {c.name ? ` · ${c.name}` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-2 text-sm">
        {profile.links.map((link, i) => (
          <li key={`${link.platform}-${i}`}>
            <a href={link.url} target="_blank" rel="noreferrer" className="text-(--pn-accent) underline">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReasonDialog({
  title,
  description,
  label = "Conferma",
  danger = false,
  initial = "",
  required = true,
  onClose,
  onSubmit,
}: {
  title: string
  description?: string
  label?: string
  danger?: boolean
  initial?: string
  /** False for confirmations that take no reason (the command ignores the text). */
  required?: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState(initial)
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
      dirty={reason !== initial}
      submitLabel={label}
      tone={danger ? "danger" : undefined}
      canSubmit={!required || !!reason.trim()}
      onSubmit={async () => {
        await onSubmit(reason)
        onClose()
      }}
    >
      {required && <TextField label="Motivazione" value={reason} onChange={setReason} multiline maxLength={4000} />}
    </FormDialog>
  )
}
