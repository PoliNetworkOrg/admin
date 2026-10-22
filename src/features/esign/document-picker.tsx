import { FileUp } from "lucide-react"
import { type DragEvent, type ReactNode, useId, useState } from "react"

import type { EsignDrive } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { DriveBrowser, type DriveFolder } from "./drive-browser"

export type DocumentPickerProps = {
  drives: EsignDrive[]
  /** The folder the last PDF came from, where the browser opens; undefined until read from storage. */
  lastFolder: Pick<DriveFolder, "driveId" | "id"> | null | undefined
  /** The drive PDF being imported. */
  busyItem: string | null
  uploading: boolean
  /** A file is dragged over the page: the dropzone lights up wherever it is. */
  dragging: boolean
  /** Shown above the browser (or above the dropzone without drives). */
  driveError?: ReactNode
  uploadError?: ReactNode
  onPickDriveFile: (itemId: string, from: DriveFolder) => void
  onUpload: (file: File) => void
}

/**
 * The ways to choose a document, both on screen at once: the shared drives on the left, a dropzone on the right. In
 * the workspace they take the places of the viewer and the request column, so a pick swaps them in place.
 */
export function DocumentPanes(props: DocumentPickerProps) {
  const { drives, driveError, uploadError } = props
  if (drives.length === 0)
    return (
      <div className="flex min-h-60 flex-col gap-3 @min-[900px]/composer:col-span-2 @min-[900px]/composer:h-full">
        {driveError}
        {uploadError}
        <Dropzone {...props} className="flex-1" />
      </div>
    )
  return (
    <>
      <div className="flex h-[60dvh] min-h-0 flex-col gap-3 @min-[900px]/composer:h-full">
        {driveError}
        <Browser {...props} className="flex-1 rounded-(--pn-r-5)" />
      </div>
      <div className="flex min-h-40 flex-col gap-3 @min-[900px]/composer:h-full">
        {uploadError}
        <Dropzone {...props} className="flex-1" />
      </div>
    </>
  )
}

/** The same choice in the Change PDF dialog: the browser, with a dropzone strip under it. */
export function DocumentDialogBody(props: DocumentPickerProps) {
  const { drives, driveError, uploadError } = props
  return (
    <>
      {driveError}
      {uploadError}
      {drives.length > 0 && <Browser {...props} className="h-80 shrink-0" />}
      <Dropzone {...props} className={drives.length > 0 ? "h-18 shrink-0" : "h-50 shrink-0"} compact />
    </>
  )
}

function Browser({
  drives,
  lastFolder,
  busyItem,
  onPickDriveFile,
  className,
}: DocumentPickerProps & { className?: string }) {
  // Opens where the last PDF came from, once local storage has been read.
  if (lastFolder === undefined) return <div className={cn("rounded-(--pn-r-4) border border-(--pn-line)", className)} />
  return (
    <DriveBrowser
      mode="file"
      label="Files"
      drives={drives}
      initialDriveId={lastFolder?.driveId}
      initialFolderId={lastFolder?.id}
      busyId={busyItem}
      onPickFile={(item, from) => onPickDriveFile(item.id, from)}
      className={className}
    />
  )
}

function Dropzone({
  uploading,
  dragging,
  onUpload,
  compact = false,
  className,
}: DocumentPickerProps & { compact?: boolean; className?: string }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-3 rounded-(--pn-r-5) border border-dashed p-6 text-center",
        "transition-[border-color,background-color] duration-120 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--pn-focus)",
        dragging
          ? "border-(--pn-accent) bg-(--pn-accent-soft)"
          : "border-(--pn-line-strong) bg-(--pn-surface) hover:bg-(--pn-hover)",
        !compact && "flex-col",
        uploading && "cursor-progress",
        className
      )}
    >
      <FileUp aria-hidden className={cn("shrink-0 text-(--pn-fg-muted)", compact ? "size-5" : "size-8")} />
      <span className="text-[15px] font-semibold text-balance">
        {uploading ? "Uploading…" : "Drop a PDF here or choose one"}
      </span>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Upload a PDF"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ""
        }}
      />
    </label>
  )
}

/** A file dragged over an area lights up its dropzone; dropping it there uploads it. Spread `handlers` on the area. */
export function useFileDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false)
  const handlers = {
    onDragOver(event: DragEvent) {
      if (!event.dataTransfer.types.includes("Files")) return
      event.preventDefault()
      setDragging(true)
    },
    onDragLeave(event: DragEvent) {
      const to = event.relatedTarget
      if (!(to instanceof Node && event.currentTarget.contains(to))) setDragging(false)
    },
    onDrop(event: DragEvent) {
      event.preventDefault()
      setDragging(false)
      const file = event.dataTransfer.files[0]
      if (file) onFile(file)
    },
  }
  return { dragging, handlers }
}
