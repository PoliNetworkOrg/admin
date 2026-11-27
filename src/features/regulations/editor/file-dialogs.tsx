import { useEffect, useState } from "react"

import {
  checkboxControl,
  ConfirmDialog,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  SelectField,
} from "@/components/primitives"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { allowedPath, FILE_NAME, fileNameFromTitle, newFileFolders, newFilePath } from "./draft-files"

export type NewFile = { path: string; title: string; include: boolean }

/**
 * "Nuovo file": a source file in one of the folders the document accepts (its `sources` globs), named from its title
 * until edited, and included in the main file with `\input` unless unticked.
 */
export function NewFileDialog({
  open,
  onOpenChange,
  files,
  sources,
  entry,
  regolamento,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: string[]
  sources: string[]
  /** The main file, where the `\input` goes; `null` when there's none to include it in. */
  entry: string | null
  /** The document is a regolamento: the title becomes the new file's `\regolamento`. */
  regolamento: boolean
  onCreate: (file: NewFile) => void
}) {
  const folders = newFileFolders(sources)
  const [folder, setFolder] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [typedName, setTypedName] = useState<string | null>(null)
  const [include, setInclude] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    if (!open) return
    setFolder(null)
    setTitle("")
    setTypedName(null)
    setInclude(true)
    setSubmitted(false)
  }, [open])

  const chosenFolder = folder ?? folders[0] ?? ""
  const name = typedName ?? fileNameFromTitle(title)
  const path = newFilePath(chosenFolder, name)
  const titleError = submitted && regolamento && !title.trim() ? "Scrivi il titolo del regolamento." : undefined
  const nameError = !submitted
    ? undefined
    : !name.trim()
      ? "Scrivi il nome del file."
      : !FILE_NAME.test(name.trim().replace(/\.tex$/i, ""))
        ? "Usa lettere, cifre, trattini e trattini bassi, iniziando con una lettera o una cifra."
        : files.includes(path)
          ? "Esiste già un file con questo nome."
          : !allowedPath(path, sources)
            ? "Il documento non accetta file con questo nome."
            : undefined

  function submit() {
    setSubmitted(true)
    const bare = name.trim().replace(/\.tex$/i, "")
    if (regolamento && !title.trim()) return
    if (!bare || !FILE_NAME.test(bare) || files.includes(path) || !allowedPath(path, sources)) return
    onCreate({ path, title: title.trim(), include: include && entry !== null })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      title="Nuovo file"
      description={
        regolamento
          ? "Un nuovo regolamento della raccolta, in un file a sé. Compare nel PDF quando il file principale lo include."
          : "Un nuovo file sorgente della bozza. Compare nel PDF quando il file principale lo include."
      }
      noun="il file"
      dirty={title.trim() !== "" || typedName !== null}
      submitLabel="Crea file"
      canSubmit={folders.length > 0}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        {folders.length > 1 ? (
          <FormField label="Cartella" htmlFor="file-folder">
            <SelectField
              id="file-folder"
              value={chosenFolder}
              options={folders.map((value) => ({ value, label: value || "Cartella principale" }))}
              onChange={setFolder}
            />
          </FormField>
        ) : null}
        {regolamento ? (
          <FormField label="Titolo del regolamento" htmlFor="file-title" error={titleError}>
            <Input
              id="file-title"
              value={title}
              maxLength={200}
              placeholder="Es. Regolamento Alumni"
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? fieldHintId("file-title") : undefined}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldControl}
            />
          </FormField>
        ) : null}
        <FormField
          label="Nome del file"
          htmlFor="file-name"
          error={nameError}
          hint={
            folders.length > 0
              ? `Il file sarà ${name.trim() ? path : `${chosenFolder}…`}`
              : "Questo documento non accetta nuovi file."
          }
        >
          <Input
            id="file-name"
            value={name}
            maxLength={64}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="Es. alumni"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={fieldHintId("file-name")}
            onChange={(event) => setTypedName(event.target.value)}
            className={cn("font-mono", fieldControl)}
          />
        </FormField>
        {entry ? (
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={include} onCheckedChange={setInclude} className={checkboxControl} />
            <span className="text-[13px] leading-5 text-(--pn-fg)">
              <span className="font-medium">Includilo in {entry}</span>
              <span className="block text-(--pn-fg-muted)">
                Aggiunge <code className="font-mono text-[12.5px]">\input</code> dopo l'ultimo file incluso: spostalo se
                va altrove.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </FormDialog>
  )
}

/** "Elimina il file": the file leaves the draft for everyone, with the `\input` lines that include it. */
export function DeleteFileDialog({
  path,
  onOpenChange,
  onConfirm,
}: {
  path: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (path: string) => void
}) {
  return (
    <ConfirmDialog
      open={path !== null}
      onOpenChange={onOpenChange}
      title="Eliminare il file?"
      description={`«${path ?? ""}» sparisce dalla bozza per tutti i membri, insieme alle righe \\input che lo includono. Le versioni pubblicate non cambiano.`}
      confirmLabel="Elimina file"
      cancelLabel="Annulla"
      onConfirm={async () => {
        if (path) onConfirm(path)
      }}
    />
  )
}
