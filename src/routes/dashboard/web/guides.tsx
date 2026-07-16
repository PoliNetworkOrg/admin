import { createFileRoute, useRouter } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  BookOpen,
  ChevronDownIcon,
  Download,
  FileText,
  LoaderCircle,
  OctagonX,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
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
import { Badge } from "@/components/ui/badge"
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
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createGuide, deleteGuide, getGuides } from "@/server/api.functions"

type Guide = { id: number; version: string; date: string; file: string }

export const Route = createFileRoute("/dashboard/web/guides")({
  loader: () => getGuides(),
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: WebGuides,
})

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function WebGuides() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const loadedGuides = response.data as Guide[]
  const [guides, setGuides] = useState(loadedGuides)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Guide | null>(null)

  useEffect(() => setGuides(loadedGuides), [loadedGuides])

  const filteredGuides = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return normalized ? guides.filter((guide) => guide.version.toLocaleLowerCase().includes(normalized)) : guides
  }, [guides, query])

  async function refresh() {
    await router.invalidate({ sync: true })
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Freshman guide"
        description="Publish and maintain the PDF editions of the Guida della Matricola."
        count={filteredGuides.length}
        total={guides.length}
        searchPlaceholder="Search by version…"
        onSearch={setQuery}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" /> Add guide
          </Button>
        }
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {response.connected &&
        (filteredGuides.length ? (
          <TableSurface>
            <Table className="min-w-[640px] text-left">
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <DataTableHead>Edition</DataTableHead>
                  <DataTableHead>Published</DataTableHead>
                  <DataTableHead>File</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuides.map((guide, index) => (
                  <TableRow key={guide.id}>
                    <TableCell className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
                          <FileText className="size-4" />
                        </span>
                        <span className="font-medium">Version {guide.version}</span>
                        {index === 0 && !query && <Badge variant="secondary">Latest</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                      <time dateTime={guide.date}>{displayDate(guide.date)}</time>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <a
                        href={guide.file}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Download guide version ${guide.version} as PDF`}
                      >
                        <Button className="flex gap-2 px-3 items-center" size="sm" variant="outline">
                          <Download /> Download
                        </Button>
                      </a>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-right">
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`Delete version ${guide.version}`}
                        onClick={() => setDeleting(guide)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSurface>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={guides.length ? "No guide matches this search" : "No guides published yet"}
            text={
              guides.length ? "Try a different version number." : "Upload the first PDF edition of the freshman guide."
            }
            action={!guides.length ? <Button onClick={() => setCreating(true)}>Add first guide</Button> : undefined}
          />
        ))}
      {creating && (
        <CreateGuideDialog
          existingVersions={guides.map((guide) => guide.version)}
          suggestedVersion={guides[0]?.version}
          onClose={() => setCreating(false)}
          onCreated={(guide) => {
            setGuides((current) => [guide, ...current])
            setCreating(false)
            toast.success("Guide published successfully")
            void refresh()
          }}
        />
      )}
      {deleting && (
        <DeleteGuideDialog
          guide={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setGuides((current) => current.filter((guide) => guide.id !== id))
            setDeleting(null)
            toast.success("Guide deleted")
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateGuideDialog({
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
  const fileInput = useRef<HTMLInputElement>(null)
  const trimmedVersion = version.trim()
  const duplicate = Boolean(trimmedVersion && existingVersions.includes(trimmedVersion))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file || duplicate) return
    if (file.type !== "application/pdf" || file.size > 2 * 1024 * 1024) {
      toast.error("Choose a PDF file no larger than 2 MB.")
      return
    }

    setPending(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("version", trimmedVersion)
      formData.set("date", date.toISOString())
      formData.set("file", file)

      onCreated(await createGuide({ data: formData }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""

      if (message.includes("DUPLICATE_VERSION")) setError("This version already exists.")
      toast.error("The guide could not be published. Check the file and your permissions.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-w-lg overflow-hidden border-border p-0">
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
                    onSelect={(d) => {
                      setDate(d)
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
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || duplicate || !trimmedVersion || !date || !file}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Publish guide
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGuideDialog({
  guide,
  onClose,
  onDeleted,
}: {
  guide: Guide
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    try {
      await deleteGuide({ data: { id: guide.id } })
      onDeleted(guide.id)
    } catch {
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
