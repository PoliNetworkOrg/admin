import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { FileButton, FormDialog, FormField } from "@/components/primitives"

import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { uploadRegulationVersion } from "./regulations-manage.functions"
import { type DocumentInfo, MAX_UPLOAD_BYTES } from "./regulations.contract"

/** "Carica nuova versione" of an uploaded document (`regulations:manage`): the PDF becomes the version in force. */
export function UploadVersionDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentInfo
}) {
  const upload = useServerFn(uploadRegulationVersion)
  const refresh = useRefreshAfter()
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const fileError = !submitted
    ? undefined
    : !file
      ? "Scegli un PDF."
      : file.size > MAX_UPLOAD_BYTES
        ? "Il PDF supera i 20 MB."
        : file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")
          ? "Il file non è un PDF."
          : undefined

  async function submit() {
    setSubmitted(true)
    if (!file || file.size > MAX_UPLOAD_BYTES) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return
    const form = new FormData()
    form.set("documentKey", document.key)
    form.set("file", file)
    try {
      await upload({ data: form })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile caricare la versione. Riprova."), {
        cause: caught,
      })
    }
    await refresh("Nuova versione caricata.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      title="Carica nuova versione"
      description={`Il PDF diventa la versione in vigore di «${document.title}»; le precedenti restano nell'elenco.`}
      noun="la versione"
      dirty={file !== null}
      submitLabel="Carica versione"
      onSubmit={submit}
    >
      <FormField label="PDF" htmlFor="version-file" error={fileError}>
        <FileButton
          id="version-file"
          file={file}
          onChange={setFile}
          accept="application/pdf,.pdf"
          label="Scegli il PDF"
          locale="it"
          invalid={fileError !== undefined}
          hint="Fino a 20 MB. Resta solo nella dashboard, mai su GitHub."
        />
      </FormField>
    </FormDialog>
  )
}
