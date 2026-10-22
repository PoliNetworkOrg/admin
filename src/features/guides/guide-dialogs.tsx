import { useServerFn } from "@tanstack/react-start"
import { isSameDay } from "date-fns"
import { useId, useState } from "react"

import { DateField, fieldControl, fieldHintId, FileButton, FormDialog, FormField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { dateOnlyValue, parseDateOnly } from "@/lib/date-only"
import { errorHasCode } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { createGuide } from "./guides.functions"
import { isValidGuideFile } from "./guides.validation"
import type { Guide } from "./types"

const DUPLICATE_VERSION = "This version already exists."

type PublishEditionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingVersions: string[]
  /** Prefilled version: the latest edition's version with its last number incremented. */
  suggestedVersion: string
  /** Reloads the route and reports success before the dialog closes. */
  onPublished: (guide: Guide) => Promise<void>
}

type Errors = { version?: string; file?: string }

function validate(version: string, file: File | null, existingVersions: string[]): Errors {
  const errors: Errors = {}
  const trimmed = version.trim()
  if (trimmed === "") errors.version = "Enter a version number."
  else if (existingVersions.includes(trimmed)) errors.version = DUPLICATE_VERSION
  if (!file) errors.file = "Choose a PDF file."
  else if (!isValidGuideFile(file)) errors.file = "Choose a PDF file no larger than 2 MB."
  return errors
}

/** "Publish a new edition". Mount with a fresh `key` per opening so the fields start from the suggestion. */
export function PublishEditionDialog({
  open,
  onOpenChange,
  existingVersions,
  suggestedVersion,
  onPublished,
}: PublishEditionDialogProps) {
  const createGuideFn = useServerFn(createGuide)
  const [initialDate] = useState(() => new Date())
  const [version, setVersion] = useState(suggestedVersion)
  const [date, setDate] = useState(initialDate)
  const [file, setFile] = useState<File | null>(null)
  const [shown, setShown] = useState<Errors>({})
  const versionId = useId()
  const dateId = useId()
  const fileId = useId()

  const dirty = version !== suggestedVersion || file !== null || !isSameDay(date, initialDate)

  /** After a field has errored, its message tracks the value on blur and change. */
  function revalidate(field: keyof Errors, nextVersion = version, nextFile = file) {
    if (!shown[field]) return
    setShown((current) => ({ ...current, [field]: validate(nextVersion, nextFile, existingVersions)[field] }))
  }

  async function submit() {
    const errors = validate(version, file, existingVersions)
    setShown(errors)
    if (errors.version || errors.file || !file) return
    const formData = new FormData()
    formData.set("version", version.trim())
    formData.set("date", date.toISOString())
    formData.set("file", file)
    let guide: Guide
    try {
      guide = await createGuideFn({ data: formData })
    } catch (cause) {
      console.error(cause)
      if (errorHasCode(cause, "DUPLICATE_VERSION")) {
        setShown((current) => ({ ...current, version: DUPLICATE_VERSION }))
        return
      }
      throw new Error(
        errorHasCode(cause, "UNAUTHORIZED")
          ? "You do not have permission to publish guides."
          : "Couldn't publish the edition. Check the file and try again."
      )
    }
    await onPublished(guide)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish a new edition"
      description="Upload a dated PDF version of the Guida della Matricola."
      noun="edition"
      dirty={dirty}
      submitLabel="Publish edition"
      onSubmit={submit}
    >
      <FormField label="Version" htmlFor={versionId} error={shown.version}>
        <Input
          id={versionId}
          value={version}
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 2.0"
          aria-invalid={shown.version ? true : undefined}
          aria-describedby={shown.version ? fieldHintId(versionId) : undefined}
          onChange={(event) => {
            setVersion(event.target.value)
            revalidate("version", event.target.value)
          }}
          onBlur={() => {
            const error = validate(version, file, existingVersions).version
            if (shown.version || error === DUPLICATE_VERSION) {
              setShown((current) => ({ ...current, version: error }))
            }
          }}
          className={cn("h-9 px-3 font-mono tabular-nums", fieldControl)}
        />
      </FormField>
      <FormField label="Date" htmlFor={dateId}>
        <DateField
          id={dateId}
          value={dateOnlyValue(date)}
          onChange={(value) => setDate(parseDateOnly(value) ?? date)}
        />
      </FormField>
      <FormField label="PDF file" htmlFor={fileId} hint="PDF only, up to 2 MB." error={shown.file}>
        <FileButton
          id={fileId}
          file={file}
          accept="application/pdf"
          label="Choose PDF"
          invalid={Boolean(shown.file)}
          onChange={(next) => {
            setFile(next)
            revalidate("file", version, next)
          }}
        />
      </FormField>
    </FormDialog>
  )
}
