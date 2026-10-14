import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { parseISO } from "date-fns"
import { BookOpen, Download, FileText, Plus, Trash2 } from "lucide-react"
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
import { appToast, Count, PageBar, PageContent, SearchField, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

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

/** Freshman guide: the PDF editions, newest first. */
export function GuidesPage({ guides }: { guides: Guide[] }) {
  const router = useRouter()
  const deleteGuideFn = useServerFn(deleteGuide)
  const canWrite = useCan("web:content:write")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishKey, setPublishKey] = useState(0)
  const [deleting, setDeleting] = useState<Guide | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const latest = guides.at(0)
  const latestId = latest?.id
  const rows = deferredQuery
    ? guides.filter((guide) => guide.version.toLocaleLowerCase().includes(deferredQuery))
    : guides

  function openPublish() {
    setPublishKey((key) => key + 1)
    setPublishOpen(true)
  }

  // The empty state repeats the header primary as outline.
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
          <span className="font-mono whitespace-nowrap">
            <span className="max-shell:hidden">Version </span>
            {guide.version}
          </span>
          {guide.id === latestId && (
            <span className="max-shell:hidden">
              <StatusBadge tone="brand">Latest</StatusBadge>
            </span>
          )}
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
          className={cn(
            buttonMotion,
            "h-9 gap-1.5 rounded-(--pn-r-2) px-2.5 text-[13px] has-data-[icon=inline-start]:pl-2 [&_svg]:text-(--pn-fg-muted)"
          )}
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
        width="tree"
        description="PDF editions of the Guida della Matricola"
        right={canWrite ? publishButton("default") : undefined}
      />
      <PageContent width="tree">
        <div className="flex flex-col gap-5">
          {latest ? (
            <section
              aria-label="Latest edition"
              className="flex flex-wrap items-center gap-5 rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface) p-5 max-shell:p-4"
            >
              <span
                aria-hidden
                className="flex h-18 w-14 shrink-0 flex-col items-center justify-center gap-1.5 rounded-(--pn-r-2) border border-(--pn-line-strong) bg-(--pn-muted) text-(--pn-fg-muted)"
              >
                <FileText strokeWidth={1.75} className="size-5" />
                <span className="font-mono text-[10px]">PDF</span>
              </span>
              <div className="flex min-w-50 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[20px] leading-7 font-semibold">Version {latest.version}</h2>
                  <StatusBadge tone="brand">Latest</StatusBadge>
                </div>
                <p className="text-[14px] text-(--pn-fg-muted)">
                  Published {formatDate(parseISO(latest.date))}, linked on the website
                </p>
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={latest.file} target="_blank" rel="noreferrer" />}
                className={cn(buttonMotion, "h-10 max-shell:w-full")}
              >
                <Download aria-hidden data-icon="inline-start" />
                Download PDF
              </Button>
            </section>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-baseline gap-2 text-[16px] font-semibold">
              All editions
              <span className="font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums">{guides.length}</span>
            </h2>
            <div className="flex flex-[0_1_300px] items-center gap-3 max-shell:basis-full">
              <SearchField value={query} onChange={setQuery} className="flex-1" />
              {deferredQuery ? <Count value={rows.length} total={guides.length} noun="edition" /> : null}
            </div>
          </div>
          <DataTable
            label="Freshman guide editions"
            compactMobile
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
        </div>
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
