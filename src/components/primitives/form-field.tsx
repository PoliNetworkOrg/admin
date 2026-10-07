import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { FieldCounter } from "./field-counter"

type FormFieldProps = {
  label: string
  htmlFor: string
  /** Adds "(optional)" to the label. Required fields are not marked. */
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
  /** Current length and limit; the counter shows in the last 20%. */
  counter?: { length: number; max: number }
  children: ReactNode
  className?: string
}

/** Label above (13/500), control, then a 12px hint or error. Give the control `aria-describedby={fieldHintId(id)}`. */
export function FormField({ label, htmlFor, optional, hint, error, counter, children, className }: FormFieldProps) {
  const describedBy = fieldHintId(htmlFor)
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] leading-5 font-medium text-(--pn-fg)">
          {label}
          {optional && <span className="font-normal text-(--pn-fg-muted)"> (optional)</span>}
        </label>
        {counter && <FieldCounter length={counter.length} max={counter.max} />}
      </div>
      {children}
      {error ? (
        <p id={describedBy} className="flex items-center gap-1.5 text-xs text-(--pn-danger-fg)">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={describedBy} className="text-xs text-(--pn-fg-muted)">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function fieldHintId(id: string): string {
  return `${id}-description`
}

/** Checkbox in a §5.10 checkbox row; checked colours come from the remapped `--primary`. */
export const checkboxControl = "mt-0.5 border-(--pn-line-strong) shadow-none"

/** Input/textarea classes for §5.10: 36px, 14px (16px on coarse pointers), strong border, surface background. */
export const fieldControl =
  "border-(--pn-line-strong) bg-(--pn-surface) text-sm text-(--pn-fg) shadow-none placeholder:text-(--pn-fg-subtle) aria-invalid:border-(--pn-danger-solid) pointer-coarse:text-base dark:bg-(--pn-surface)"
