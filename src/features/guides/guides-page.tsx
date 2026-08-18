import { useRouter } from "@tanstack/react-router"
import { BookOpen, Download, FileText, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { CreateGuideDialog, DeleteGuideDialog } from "./guide-dialogs"
import type { Guide } from "./types"

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function GuidesPage({ loadedGuides }: { loadedGuides: Guide[] }) {
  const router = useRouter()
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
    try {
      await router.invalidate({ sync: true })
    } catch {
      toast.warning("Your change was saved, but the latest guide list could not be refreshed.")
    }
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
      {filteredGuides.length ? (
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
                      <Button className="flex items-center gap-2 px-3" size="sm" variant="outline">
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
      )}
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
