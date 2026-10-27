import { FileText, Upload, X } from "lucide-react"
import { useId, useRef } from "react"

import { cn } from "@/lib/utils"

import { Hint } from "./hint"
import { LoadingButton } from "./loading-button"

type FileButtonProps = {
  file: File | null
  onChange: (file: File | null) => void
  /** e.g. "image/png,image/jpeg" */
  accept?: string
  /** Type and size limit, e.g. "PNG or JPEG, up to 1 MB." */
  hint?: string
  label?: string
  invalid?: boolean
  id?: string
  className?: string
}

/** The outline button over a hidden file input. `FileButton` adds the chosen file's chip; alone it picks several. */
export function FilePickerButton({
  id,
  onFiles,
  accept,
  multiple = false,
  label,
  pending = false,
  invalid = false,
  describedBy,
}: {
  id?: string
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  label: string
  pending?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // Cleared so choosing the same file again still fires a change.
          event.target.value = ""
          onFiles(files)
        }}
        className="sr-only"
        tabIndex={-1}
      />
      <LoadingButton
        type="button"
        variant="outline"
        icon={Upload}
        pending={pending}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
        className={cn("shadow-none", invalid && "border-(--pn-danger-solid)")}
      >
        {label}
      </LoadingButton>
    </>
  )
}

/** Outline "Choose file" button + selected filename chip with remove, and the type/size hint. */
export function FileButton({
  file,
  onChange,
  accept,
  hint,
  label = "Choose file",
  invalid = false,
  id,
  className,
}: FileButtonProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <FilePickerButton
          id={inputId}
          accept={accept}
          label={label}
          invalid={invalid}
          describedBy={hint ? hintId : undefined}
          onFiles={(files) => onChange(files[0] ?? null)}
        />
        {file && (
          <span className="inline-flex h-7 max-w-64 items-center gap-1.5 rounded-(--pn-r-full) bg-(--pn-muted) pr-0.5 pl-2.5 text-xs font-medium text-(--pn-fg)">
            <FileText aria-hidden className="size-3.5 shrink-0 text-(--pn-fg-muted)" />
            <Hint overflowOnly label={file.name}>
              <span className="truncate">{file.name}</span>
            </Hint>
            <Hint label="Remove file">
              <button
                type="button"
                aria-label="Remove file"
                onClick={() => onChange(null)}
                className="relative flex size-6 shrink-0 items-center justify-center rounded-full text-(--pn-fg-muted) transition-[background-color,color] duration-120 after:absolute after:-inset-1.5 hover:bg-(--pn-hover) hover:text-(--pn-fg)"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </Hint>
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-(--pn-fg-muted)">
          {hint}
        </p>
      )}
    </div>
  )
}
