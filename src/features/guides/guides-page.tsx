import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { parseISO } from "date-fns"
import { BookOpen, Download, Plus, Trash2 } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  StatusBadge,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"

import { PublishEditionDialog } from "./guide-dialogs"
import { deleteGuide } from "./guides.functions"
import type { Guide } from "./types"

/** "2.1" → "2.2"; falls back to the version itself when its last segment is not a number. */
function nextVersion(version: string | undefined) {
  if (!version) return "1.0"
  const match = /^(.*?)(\d+)$/.exec(version)
  if (!match) return version
  return `${match[1]}${Number(match[2]) + 1}`
}

/** Freshman guide (docs/design.md §7.12): the PDF editions, newest first. */
export function GuidesPage({ guides }: { guides: Guide[] }) {
  const router = useRouter()
  const deleteGuideFn = useServerFn(deleteGuide)
  const canWrite = useCanWrite("web")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishKey, setPublishKey] = useState(0)
  const [deleting, setDeleting] = useState<Guide | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const latestId = guides[0]?.id
  const rows = deferredQuery
    ? guides.filter((guide) => guide.version.toLocaleLowerCase().includes(deferredQuery))
    : guides

  function openPublish() {
    setPublishKey((key) => key + 1)
    setPublishOpen(true)
  }

  // The empty state repeats the header primary as outline (§8.4).
  const publishButton = (variant: "default" | "outline") => (
    <Button variant={variant} size="sm" className={buttonMotion} onClick={openPublish}>
      <Plus aria-hidden data-icon="inline-start" />
      Publish edition
    </Button>
  )

  const columns: DataTableColumn<Guide>[] = [
    {
      id: "edition",
      label: "Edition",
      minWidth: 200,
      cell: (guide) => (
        <span className="flex items-center gap-2">
          <span className="whitespace-nowrap">Version {guide.version}</span>
          {guide.id === latestId && <StatusBadge tone="brand">Latest</StatusBadge>}
        </span>
      ),
    },
    {
      id: "published",
      label: "Published",
      cell: (guide) => <span className="whitespace-nowrap tabular-nums">{formatDate(parseISO(guide.date))}</span>,
    },
    {
      id: "file",
      label: "File",
      cell: (guide) => (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          aria-label={`Download version ${guide.version} PDF`}
          render={<a href={guide.file} target="_blank" rel="noreferrer" />}
          className={buttonMotion}
        >
          <Download aria-hidden data-icon="inline-start" />
          PDF
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery }}
            count={<Count value={rows.length} total={deferredQuery ? guides.length : undefined} noun="edition" />}
          />
        }
        right={canWrite ? publishButton("default") : undefined}
      />
      <PageContent>
        <DataTable
          label="Freshman guide editions"
          columns={columns}
          rows={rows}
          getRowId={(guide) => String(guide.id)}
          actions={
            canWrite
              ? (guide) => (
                  <IconButton
                    label="Delete edition"
                    ariaLabel={`Delete version ${guide.version}`}
                    icon={Trash2}
                    tone="danger"
                    onClick={() => {
                      setDeleting(guide)
                      setConfirmOpen(true)
                    }}
                  />
                )
              : undefined
          }
          empty={
            deferredQuery ? (
              <EmptyState
                icon={BookOpen}
                title="No editions match"
                text="Try a different version number."
                action={
                  <Button variant="ghost" size="sm" className={buttonMotion} onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No editions yet"
                text="Upload the first PDF edition of the Guida della Matricola."
                action={canWrite ? publishButton("outline") : undefined}
              />
            )
          }
        />
      </PageContent>
      {canWrite && (
        <PublishEditionDialog
          key={publishKey}
          open={publishOpen}
          onOpenChange={setPublishOpen}
          existingVersions={guides.map((guide) => guide.version)}
          suggestedVersion={nextVersion(guides[0]?.version)}
          onPublished={async (guide) => {
            await router.invalidate({ sync: true })
            appToast.success(`Edition ${guide.version} published.`)
          }}
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete edition?"
        description={`Version ${deleting?.version ?? ""} is removed and its PDF is no longer linked. This cannot be undone.`}
        confirmLabel="Delete edition"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await deleteGuideFn({ data: { id: deleting.id } })
          } catch (error) {
            console.error(error)
            throw new Error("Couldn't delete the edition.")
          }
          await router.invalidate({ sync: true })
          appToast.success("Edition deleted.")
        }}
      />
    </>
  )
}
