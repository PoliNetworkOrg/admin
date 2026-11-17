import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import type { z } from "zod"

import { FileButton, FormDialog, FormField, SelectField, fieldControl } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { LOGO_MAX_BYTES, linkSchema, type Profile } from "./portal.contract"
import { uploadPortalLogo } from "./portal.functions"

export const EMPTY_PROFILE: Profile = {
  name: "",
  acronym: "",
  descriptionIt: "",
  descriptionEn: "",
  email: "",
  logo: null,
  links: [],
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

export function ProfileFields({
  value,
  onChange,
  associationId,
}: {
  value: Profile
  onChange: (value: Profile) => void
  associationId?: string
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
                options={Object.entries(platformLabel).map(([value, label]) => ({ value, label }))}
                onChange={(v) =>
                  onChange({
                    ...value,
                    links: value.links.map((l, i) =>
                      i === index ? { ...l, platform: linkSchema.parse({ ...l, platform: v }).platform } : l
                    ),
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

export function ProfilePreview({ profile }: { profile: Profile | null }) {
  if (!profile) return <p className="text-sm text-(--pn-fg-muted)">Nessuna versione pubblicata.</p>
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
      {profile.email && <p className="text-sm">{profile.email}</p>}
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
