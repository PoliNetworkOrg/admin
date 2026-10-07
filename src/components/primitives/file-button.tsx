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
  const inputRef = useRef<HTMLInputElement>(null)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  function clear() {
    if (inputRef.current) inputRef.current.value = ""
    onChange(null)
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="sr-only"
          tabIndex={-1}
        />
        <LoadingButton
          type="button"
          variant="outline"
          icon={Upload}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => inputRef.current?.click()}
          className={cn("shadow-none", invalid && "border-(--pn-danger-solid)")}
        >
          {label}
        </LoadingButton>
        {file && (
          <span className="inline-flex h-7 max-w-64 items-center gap-1.5 rounded-(--pn-r-full) bg-(--pn-muted) pr-0.5 pl-2.5 text-xs font-medium text-(--pn-fg)">
            <FileText aria-hidden className="size-3.5 shrink-0 text-(--pn-fg-muted)" />
            <span className="truncate" title={file.name}>
              {file.name}
            </span>
            <Hint label="Remove file">
              <button
                type="button"
                aria-label="Remove file"
                onClick={clear}
                className="relative flex size-6 shrink-0 items-center justify-center rounded-full text-(--pn-fg-muted) transition-[background-color,color] duration-120 after:absolute after:-inset-1.5 hover:bg-(--pn-nav-active) hover:text-(--pn-fg)"
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
