import { useServerFn } from "@tanstack/react-start"
import { isSameDay } from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"
import { useId, useState } from "react"

import {
  buttonMotion,
  fieldControl,
  fieldHintId,
  FileButton,
  floatingMotion,
  FormDialog,
  FormField,
  raisedSurface,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { errorHasCode } from "@/lib/errors"
import { formatDate } from "@/lib/format"
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

/** "Publish a new edition" (§7.12). Mount with a fresh `key` per opening so the fields start from the suggestion. */
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
  const [datePickerOpen, setDatePickerOpen] = useState(false)
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
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger
            render={
              <Button
                id={dateId}
                variant="outline"
                size="sm"
                className={cn(
                  buttonMotion,
                  "w-full justify-start gap-2 border-(--pn-line-strong) bg-(--pn-surface) px-3 text-sm font-normal text-(--pn-fg) shadow-none hover:bg-(--pn-muted) dark:bg-(--pn-surface)"
                )}
              />
            }
          >
            <CalendarDays aria-hidden className="text-(--pn-fg-muted)" />
            <span className="tabular-nums">{formatDate(date)}</span>
            <ChevronDown aria-hidden className="ml-auto text-(--pn-fg-muted)" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(raisedSurface, floatingMotion, "w-auto overflow-hidden rounded-(--pn-r-4) p-0")}
          >
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              captionLayout="dropdown"
              weekStartsOn={1}
              required
              onSelect={(selected) => {
                setDate(selected)
                setDatePickerOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
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
