import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useMemo, useState } from "react"

import {
  fieldControl,
  FormDialog,
  FormField,
  InlineAlert,
  RadioCard,
  RadioCardGroup,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Input } from "@/components/ui/input"

import { createRectification } from "./regulations-draft.functions"
import { baseLabel, formatDay, todayInRome, versionOrigin } from "./regulations-format"
import { failureMessage, useLoaded } from "./regulations-hooks"
import { createDraft } from "./regulations-write.functions"
import type { Me } from "./regulations.contract"
import { getRegulationDocument } from "./regulations.functions"

export type NewDraftTarget =
  | {
      kind: "modifica"
      /** The documents to choose from (v1: the RRI only). */
      documents: { key: string; title: string }[]
      /** Preselected document and base, e.g. "Nuova bozza da qui" on a version. */
      documentKey?: string
      from?: { kind: "version" | "draft"; id: string }
    }
  | {
      kind: "rettifica"
      /** `me.rectifiable`: what the caller may rectify, with each latest version (no `regulations:read` needed). */
      documents: Me["rectifiable"]
    }

/**
 * Starts a draft. A modifica is based on a published version or on another draft (a working table); a rettifica
 * always starts from the latest version. Opens the editor once created.
 */
export function NewDraftDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: NewDraftTarget
}) {
  const create = useServerFn(createDraft)
  const rectify = useServerFn(createRectification)
  const load = useServerFn(getRegulationDocument)
  const navigate = useNavigate()
  const rettifica = target.kind === "rettifica"
  const documents =
    target.kind === "rettifica"
      ? target.documents.map((document) => ({ key: document.documentKey, title: document.title }))
      : target.documents
  const [documentKey, setDocumentKey] = useState(
    (target.kind === "modifica" ? target.documentKey : undefined) ?? documents[0]?.key ?? ""
  )
  const [from, setFrom] = useState(
    target.kind === "modifica" && target.from ? `${target.from.kind}:${target.from.id}` : null
  )
  const [title, setTitle] = useState(rettifica ? `Rettifica del ${formatDay(todayInRome())}` : "")
  const [submitted, setSubmitted] = useState(false)

  // A rettifica starts from the latest version, which `me.rectifiable` names; a modifica lists versions and drafts.
  const { data, failed } = useLoaded(
    useMemo(
      () => (open && documentKey && !rettifica ? () => load({ data: { documentKey } }) : null),
      [open, documentKey, rettifica, load]
    )
  )
  const latest =
    target.kind === "rettifica" ? target.documents.find((document) => document.documentKey === documentKey) : null
  const bases = data
    ? [
        ...data.versions.slice(0, 5).map((version) => ({
          value: `version:${version.id}`,
          label: `Versione ${version.label}`,
          description: versionOrigin(version),
        })),
        ...data.drafts
          .filter((draft) => draft.state !== "emanata")
          .map((draft) => ({
            value: `draft:${draft.id}`,
            label: baseLabel({ kind: "draft", title: draft.title }),
            description: `Tavolo di lavoro, aggiornata il ${formatDay(draft.updatedAt)}`,
          })),
      ]
    : []
  const chosen = rettifica
    ? latest?.latestVersionId
      ? `version:${latest.latestVersionId}`
      : null
    : (from ?? bases[0]?.value ?? null)
  const titleError = submitted && !title.trim() ? "Scrivi un titolo." : undefined

  async function submit() {
    setSubmitted(true)
    if (!title.trim() || !chosen) return
    const [, kind, id] = /^(version|draft):(.+)$/.exec(chosen) ?? []
    if (!id) return
    const base = kind === "draft" ? { kind: "draft" as const, id } : { kind: "version" as const, id }
    let created: { id: string }
    try {
      const input = { documentKey, title: title.trim(), from: base }
      created = rettifica
        ? await rectify({ data: { ...input, kind: "rettifica" } })
        : await create({ data: { ...input, kind: "modifica" } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile creare la bozza. Riprova."), { cause: caught })
    }
    onOpenChange(false)
    appToast.success(rettifica ? "Rettifica creata." : "Bozza creata.")
    await navigate({ to: "/dashboard/regulations/drafts/$draftId", params: { draftId: created.id } })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      title={rettifica ? "Nuova rettifica" : "Nuova bozza"}
      description={
        rettifica
          ? "Solo correzioni di errori che non cambiano il significato del testo. Parte dall'ultima versione emanata e si emana senza approvazione."
          : "Ogni bozza è un tavolo di lavoro: la puoi condividere, unire ad altre bozze e poi inviare in approvazione."
      }
      noun="la bozza"
      dirty={title.trim() !== "" && !rettifica}
      submitLabel={rettifica ? "Crea rettifica" : "Crea bozza"}
      canSubmit={chosen !== null}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        <FormField label="Titolo" htmlFor="draft-title" error={titleError}>
          <Input
            id="draft-title"
            value={title}
            maxLength={120}
            placeholder={rettifica ? undefined : "Es. Revisione del Regolamento di Condotta"}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldControl}
          />
        </FormField>
        {documents.length > 1 && (
          <FormField label="Documento" htmlFor="draft-document">
            <SelectField
              id="draft-document"
              value={documentKey}
              options={documents.map((document) => ({ value: document.key, label: document.title }))}
              onChange={(key) => {
                setDocumentKey(key)
                setFrom(null)
              }}
            />
          </FormField>
        )}
        {rettifica ? (
          latest?.latestVersionLabel ? (
            <p className="text-[13px] text-(--pn-fg-muted)">
              Parte da: <span className="font-medium text-(--pn-fg)">Versione {latest.latestVersionLabel}</span>
            </p>
          ) : (
            <InlineAlert>Questo documento non ha ancora una versione da rettificare.</InlineAlert>
          )
        ) : failed ? (
          <InlineAlert>Non è stato possibile caricare le versioni. Chiudi e riprova.</InlineAlert>
        ) : !data ? (
          <div className="flex items-center gap-2 text-[13px] text-(--pn-fg-muted)">
            <Spinner /> Caricamento delle versioni…
          </div>
        ) : (
          <RadioCardGroup label="Parti da" value={chosen} onValueChange={setFrom}>
            {bases.map((base) => (
              <RadioCard key={base.value} value={base.value} label={base.label} description={base.description} />
            ))}
          </RadioCardGroup>
        )}
      </div>
    </FormDialog>
  )
}
