import { useServerFn } from "@tanstack/react-start"
import { ArrowUp, FileText, Folder, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { IconButton, InlineAlert } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import type { EsignDriveItem, EsignDriveListing } from "@/lib/api/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { listEsignDrive } from "./requests.functions"

type DriveBrowserProps = {
  /** "file" picks a PDF, "folder" picks the open folder. */
  mode: "file" | "folder"
  label: string
  /** A PDF, with the folder it is in. */
  onPickFile?: (item: EsignDriveItem, folder: { id: string; path: string }) => void
  onPickFolder?: (folder: { id: string; path: string }) => void
  /** The item being imported, shown with a spinner. */
  busyId?: string | null
  className?: string
}

function sizeLabel(bytes: number | null) {
  if (bytes === null) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Walks the association's shared drive (below its configured root) to pick a PDF or a folder. */
export function DriveBrowser({ mode, label, onPickFile, onPickFolder, busyId, className }: DriveBrowserProps) {
  const listFn = useServerFn(listEsignDrive)
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [listing, setListing] = useState<EsignDriveListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listFn({ data: { folderId } })
      .then((result) => {
        if (!cancelled) setListing(result)
      })
      .catch((cause: unknown) => {
        console.error(cause)
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Couldn't open the folder.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [folderId, listFn])

  const items = listing?.items.filter((item) => mode === "file" || item.kind === "folder") ?? []

  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-(--pn-r-4) border border-(--pn-line)", className)}
    >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-(--pn-line) bg-(--pn-surface) pr-2 pl-1">
        <IconButton
          label="Up one folder"
          icon={ArrowUp}
          disabled={!listing || listing.folder.isRoot}
          onClick={() => setFolderId(listing?.folder.parentId ?? undefined)}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-(--pn-fg-muted)">
          /{listing?.path ?? ""}
        </span>
        {loading && <LoaderCircle aria-label="Loading" className="size-4 animate-spin text-(--pn-fg-muted)" />}
      </div>
      {error ? (
        <div className="p-3">
          <InlineAlert>{error}</InlineAlert>
        </div>
      ) : (
        <ul aria-label={label} className="min-h-0 flex-1 overflow-y-auto bg-(--pn-surface) py-1">
          {listing && items.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-(--pn-fg-muted)">
              {mode === "file" ? "No PDFs or folders here" : "No folders here"}
            </li>
          )}
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() =>
                  item.kind === "folder"
                    ? setFolderId(item.id)
                    : listing && onPickFile?.(item, { id: listing.folder.id, path: listing.path })
                }
                className="flex h-11 w-full items-center gap-3 px-3 text-left text-[14px] transition-colors duration-120 hover:bg-(--pn-hover) disabled:opacity-60"
              >
                {item.kind === "folder" ? (
                  <Folder aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
                ) : busyId === item.id ? (
                  <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-(--pn-accent)" />
                ) : (
                  <FileText aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.kind === "pdf" && (
                  <span className="shrink-0 text-[12px] text-(--pn-fg-muted) tabular-nums">
                    {item.modifiedAt ? formatDate(new Date(item.modifiedAt)) : ""} {sizeLabel(item.size)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === "folder" && listing && (
        <div className="flex shrink-0 items-center justify-end border-t border-(--pn-line) bg-(--pn-surface) p-2">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => onPickFolder?.({ id: listing.folder.id, path: listing.path })}
          >
            Save here
          </Button>
        </div>
      )}
    </div>
  )
}
