import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import { ChevronDownIcon, LoaderCircle, OctagonX, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { errorHasCode } from "@/lib/errors"
import { createGuide, deleteGuide } from "./guides.functions"
import type { Guide } from "./types"

export function CreateGuideDialog({
  existingVersions,
  suggestedVersion,
  onClose,
  onCreated,
}: {
  existingVersions: string[]
  suggestedVersion?: string
  onClose: () => void
  onCreated: (guide: Guide) => void
}) {
  const [version, setVersion] = useState(suggestedVersion ?? "")
  const [date, setDate] = useState(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const initialVersion = useRef(suggestedVersion ?? "")
  const initialDate = useRef(date)
  const createGuideFn = useServerFn(createGuide)
  const trimmedVersion = version.trim()
  const duplicate = Boolean(trimmedVersion && existingVersions.includes(trimmedVersion))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file || duplicate) return
    if (file.type !== "application/pdf" || file.size > 2 * 1024 * 1024) {
      setError("Choose a PDF file no larger than 2 MB.")
      return
    }

    setPending(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("version", trimmedVersion)
      formData.set("date", date.toISOString())
      formData.set("file", file)

      onCreated(await createGuideFn({ data: formData }))
    } catch (cause) {
      console.error(cause)
      setError(
        errorHasCode(cause, "DUPLICATE_VERSION")
          ? "This version already exists."
          : errorHasCode(cause, "UNAUTHORIZED")
            ? "You do not have permission to publish guides."
            : "The guide could not be published. Check the file and try again."
      )
    } finally {
      setPending(false)
    }
  }

  const dirty = version !== initialVersion.current || Boolean(file) || date.getTime() !== initialDate.current.getTime()

  function requestClose() {
    if (pending) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">WEB · GUIDES</p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Publish a new edition</DialogTitle>
          <DialogDescription>Upload a dated PDF version of the Guida della Matricola.</DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <Field data-invalid={duplicate || undefined}>
              <FieldLabel htmlFor="guide-version">Version</FieldLabel>
              <Input
                id="guide-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="e.g. 2.0"
                aria-invalid={duplicate}
                required
                autoFocus
              />
              <FieldError>{duplicate ? "This version already exists." : undefined}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="date-picker">Date</FieldLabel>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" id="date-picker" className="w-full justify-between font-normal">
                      {date ? format(date, "dd/MM/yyyy") : "Select date"}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  }
                />
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    captionLayout="dropdown"
                    defaultMonth={date}
                    required
                    onSelect={(selectedDate) => {
                      setDate(selectedDate)
                      setDatePickerOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>
            <Field>
              <FieldLabel htmlFor="guide-file">PDF file</FieldLabel>
              <Input
                ref={fileInput}
                id="guide-file"
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-normal"
                onClick={() => fileInput.current?.click()}
              >
                <Upload data-icon="inline-start" />{" "}
                <span className="truncate">{file?.name ?? "Choose a PDF file…"}</span>
              </Button>
              <FieldDescription>PDF only, up to 2 MB.</FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          {confirmDiscard && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Discard guide changes?</AlertTitle>
              <AlertDescription>Your unsaved edition details and selected file will be lost.</AlertDescription>
              <AlertAction className="mt-3 flex gap-2 sm:mt-0">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={onClose}>
                  Discard changes
                </Button>
              </AlertAction>
            </Alert>
          )}
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={requestClose} disabled={confirmDiscard}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={confirmDiscard || pending || duplicate || !trimmedVersion || !date || !file}
            >
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Publish guide
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteGuideDialog({
  guide,
  onClose,
  onDeleted,
}: {
  guide: Guide
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const [pending, setPending] = useState(false)
  const deleteGuideFn = useServerFn(deleteGuide)

  async function remove() {
    setPending(true)
    try {
      await deleteGuideFn({ data: { id: guide.id } })
      onDeleted(guide.id)
    } catch (error) {
      console.error(error)
      toast.error("The guide could not be deleted. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete Guide</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete version <strong>{guide.version}</strong>? <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} variant="outline" onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin-slow" /> : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
