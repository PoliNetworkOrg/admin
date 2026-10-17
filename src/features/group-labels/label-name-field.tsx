import { useState } from "react"

import { fieldControl, fieldHintId, FormField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { GROUP_LABEL_MAX } from "./group-labels.constants"
import { hasReleaseLabelPrefix, isReservedCategoryRoot, isValidLabelSegment } from "./label-tree"

type LabelNameKind = "category" | "attribute" | "publication"

/** The label dialogs' validation copy, verbatim. Empty names are not an error: the submit button stays disabled. */
function labelNameError(name: string, kind: LabelNameKind): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (!isValidLabelSegment(trimmed)) return "Use a plain name, without dots or URL separators."
  if (kind === "publication" && hasReleaseLabelPrefix(trimmed)) return "Enter the name without the release- prefix."
  if (kind === "attribute" && hasReleaseLabelPrefix(trimmed)) {
    return "The release- prefix is reserved. Use Create publication instead."
  }
  if (kind === "attribute" && isReservedCategoryRoot(trimmed)) return "This name is reserved for a category."
  return null
}

/**
 * Name field state with the form validation timing: validated on submit, then re-validated on blur once it has errored.
 * `check()` runs the submit-time validation and returns whether the value may be saved.
 */
export function useLabelName(kind: LabelNameKind, initial = "") {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  return {
    value,
    trimmed: value.trim(),
    error,
    setValue,
    onBlur: () => {
      if (error !== null) setError(labelNameError(value, kind))
    },
    check: () => {
      const next = labelNameError(value, kind)
      setError(next)
      return next === null
    },
    reset: (next = initial) => {
      setValue(next)
      setError(null)
    },
  }
}

type LabelNameFieldProps = {
  id: string
  field: ReturnType<typeof useLabelName>
  placeholder?: string
  maxLength?: number
}

export function LabelNameField({ id, field, placeholder, maxLength = GROUP_LABEL_MAX }: LabelNameFieldProps) {
  return (
    <FormField label="Name" htmlFor={id} error={field.error}>
      <Input
        id={id}
        value={field.value}
        onChange={(event) => field.setValue(event.target.value)}
        onBlur={field.onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={field.error !== null || undefined}
        aria-describedby={field.error ? fieldHintId(id) : undefined}
        className={cn("h-9", fieldControl)}
      />
    </FormField>
  )
}

/** Resets a dialog's form state each time it opens, without an effect (state adjusted during render). */
export function useResetOnOpen(open: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) reset()
  }
}

/** Focuses a field that a dialog step is about to render (fine pointers only, like the dialog's own autofocus). */
export function focusFieldSoon(id: string) {
  if (!window.matchMedia("(pointer: fine)").matches) return
  requestAnimationFrame(() => document.getElementById(id)?.focus())
}
