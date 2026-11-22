import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useMemo, useState } from "react"

import {
  FileButton,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  InlineAlert,
  RadioCard,
  RadioCardGroup,
  SegmentedControl,
  Spinner,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { failureMessage, useLoaded, useRefreshAfter } from "./regulations-hooks"
import { createRegulationDocument, uploadRegulationDocument } from "./regulations-manage.functions"
import { type DocumentStorage, documentKeySchema, MAX_UPLOAD_BYTES } from "./regulations.contract"
import { getRegulationTemplates } from "./regulations.functions"

type Mode = "template" | "upload"

/** What each template of `documents.json` is for; a template the dashboard doesn't know shows its folder. */
function templateDescription(template: { key: string; directory: string }) {
  if (template.key === "regolamento") return "Struttura in articoli e commi, come la Raccolta dei Regolamenti Interni."
  if (template.key === "generale")
    return "Il modello dei documenti di PoliNetwork: intestazione, caratteri e colori dell'Associazione."
  return `Cartella ${template.directory}`
}

/** A key from a title, as the backend accepts it: lowercase letters, digits and dashes, from a letter, ≤ 40. */
export function keyFromTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40)
    .replace(/-+$/, "")
}

/**
 * "Nuovo documento" (`regulations:manage`): from a template of `documents.json`, in the repository (a pull request
 * that adds it, so it appears once merged) or private (only in the dashboard, opened at once); or "Carica un PDF", a
 * private read-only document.
 */
export function NewDocumentDialog({
  open,
  onOpenChange,
  takenKeys,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Keys already in use, refused before asking the backend (which checks them again). */
  takenKeys: string[]
}) {
  const create = useServerFn(createRegulationDocument)
  const upload = useServerFn(uploadRegulationDocument)
  const loadTemplates = useServerFn(getRegulationTemplates)
  const navigate = useNavigate()
  const refresh = useRefreshAfter()
  const [mode, setMode] = useState<Mode>("template")
  const [title, setTitle] = useState("")
  const [typedKey, setTypedKey] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [storage, setStorage] = useState<DocumentStorage>("repo")
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const templates = useLoaded(useMemo(() => (open ? () => loadTemplates() : null), [open, loadTemplates]))
  const chosenTemplate = template ?? templates.data?.[0]?.key ?? null
  const directory = templates.data?.find((candidate) => candidate.key === chosenTemplate)?.directory ?? ""
  // The key follows the title until it's edited.
  const key = typedKey ?? keyFromTitle(title)

  const titleError = submitted && !title.trim() ? "Scrivi un titolo." : undefined
  const keyError = !submitted
    ? undefined
    : !key
      ? "Scrivi una chiave."
      : !documentKeySchema.safeParse(key).success
        ? "Usa lettere minuscole, cifre e trattini, iniziando con una lettera (al massimo 40 caratteri)."
        : takenKeys.includes(key)
          ? "Esiste già un documento con questa chiave."
          : undefined
  const fileError =
    mode !== "upload" || !submitted
      ? undefined
      : !file
        ? "Scegli un PDF."
        : file.size > MAX_UPLOAD_BYTES
          ? "Il PDF supera i 20 MB."
          : file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")
            ? "Il file non è un PDF."
            : undefined
  const ready = mode === "upload" || chosenTemplate !== null

  async function submit() {
    setSubmitted(true)
    if (!title.trim() || !key || !documentKeySchema.safeParse(key).success || takenKeys.includes(key)) return
    const input = { key, title: title.trim() }
    if (mode === "upload") {
      if (!file || file.size > MAX_UPLOAD_BYTES) return
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return
      const form = new FormData()
      form.set("key", input.key)
      form.set("title", input.title)
      form.set("file", file)
      try {
        await upload({ data: form })
      } catch (caught) {
        console.error(caught)
        throw new Error(failureMessage(caught, "Non è stato possibile caricare il documento. Riprova."), {
          cause: caught,
        })
      }
      onOpenChange(false)
      appToast.success("Documento caricato.")
      await navigate({ to: "/dashboard/regulations/documents/$documentKey", params: { documentKey: key } })
      return
    }
    if (!chosenTemplate) return
    try {
      await create({ data: { ...input, template: chosenTemplate, storage } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile creare il documento. Riprova."), { cause: caught })
    }
    if (storage === "repo") {
      // It exists once the pull request merges: the list shows it as "In creazione" with the link meanwhile.
      await refresh("Pull request aperta: il documento compare appena viene unita.")
      onOpenChange(false)
      return
    }
    onOpenChange(false)
    appToast.success("Documento creato.")
    await navigate({ to: "/dashboard/regulations/documents/$documentKey", params: { documentKey: key } })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      title="Nuovo documento"
      description="Un documento nuovo da un modello, da scrivere in bozza, oppure un PDF già pronto da conservare."
      noun="il documento"
      dirty={title.trim() !== "" || file !== null}
      submitLabel={mode === "upload" ? "Carica documento" : "Crea documento"}
      canSubmit={ready}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          label="Come creare il documento"
          value={mode}
          onValueChange={setMode}
          className="w-full"
          itemClassName="flex-1"
          items={[
            { value: "template", label: "Da un modello" },
            { value: "upload", label: "Carica un PDF" },
          ]}
        />
        <FormField label="Titolo" htmlFor="document-title" error={titleError}>
          <Input
            id="document-title"
            value={title}
            maxLength={120}
            placeholder={mode === "upload" ? "Es. Bilancio consuntivo 2026" : "Es. Regolamento degli eventi"}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? fieldHintId("document-title") : undefined}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldControl}
          />
        </FormField>
        <FormField
          label="Chiave"
          htmlFor="document-key"
          error={keyError}
          hint={
            mode === "template" && storage === "repo"
              ? `Nel repository: ${directory}${key || "chiave"}/. Non si cambia più.`
              : "Identifica il documento nella dashboard. Non si cambia più."
          }
        >
          <Input
            id="document-key"
            value={key}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-invalid={keyError ? true : undefined}
            aria-describedby={fieldHintId("document-key")}
            onChange={(event) => setTypedKey(event.target.value)}
            className={cn(fieldControl, "font-mono")}
          />
        </FormField>
        {mode === "upload" ? (
          <FormField label="PDF" htmlFor="document-file" error={fileError}>
            <FileButton
              id="document-file"
              file={file}
              onChange={setFile}
              accept="application/pdf,.pdf"
              label="Scegli il PDF"
              locale="it"
              invalid={fileError !== undefined}
              hint="Fino a 20 MB. Resta privato: solo nella dashboard, mai su GitHub. Non si modifica: una nuova versione è un nuovo caricamento."
            />
          </FormField>
        ) : (
          <>
            {templates.failed ? (
              <InlineAlert>Non è stato possibile caricare i modelli. Chiudi e riprova.</InlineAlert>
            ) : !templates.data ? (
              <div className="flex items-center gap-2 text-[13px] text-(--pn-fg-muted)" role="status">
                <Spinner /> Caricamento dei modelli…
              </div>
            ) : (
              <RadioCardGroup label="Modello" value={chosenTemplate} onValueChange={setTemplate}>
                {templates.data.map((candidate) => (
                  <RadioCard
                    key={candidate.key}
                    value={candidate.key}
                    label={candidate.title}
                    description={templateDescription(candidate)}
                  />
                ))}
              </RadioCardGroup>
            )}
            <RadioCardGroup label="Dove" value={storage} onValueChange={setStorage}>
              <RadioCard
                value="repo"
                label="Repository documents"
                description="Pubblico nel repository, creato tramite pull request: compare qui appena viene unita."
              />
              <RadioCard
                value="private"
                label="Privato"
                description="Solo nella dashboard, mai su GitHub. Si apre subito, con il testo del modello."
              />
            </RadioCardGroup>
          </>
        )}
      </div>
    </FormDialog>
  )
}
