import { Languages } from "lucide-react"
import type { MouseEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

const LANGUAGE_NAMES = { it: "Italian", en: "English" } as const

export type TranslationLanguage = keyof typeof LANGUAGE_NAMES

/**
 * Lays out one `TranslationPanel` per language: side by side once the container is 560px wide (so IT and EN can be
 * compared line by line, at the same height), stacked below that.
 */
export function TranslationGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("@container min-w-0", className)}>
      <div className="grid gap-3 @min-[560px]:grid-cols-2">{children}</div>
    </div>
  )
}

type TranslationPanelProps = {
  lang: TranslationLanguage
  /**
   * Edit mode: the panel is the field (pair it with `bare` fields). Same size and background as view mode; only the
   * accent border and label appear, stronger while a field inside has focus, and a click on the panel focuses its
   * first field.
   */
  editing?: boolean
  children: ReactNode
  className?: string
}

/**
 * One language of a bilingual text: a `Languages` icon + "IT"/"EN" header over the content. `lang` is set on
 * the panel, so screen readers and the textarea spellchecker use the right language.
 */
export function TranslationPanel({ lang, editing = false, children, className }: TranslationPanelProps) {
  return (
    <div
      role="group"
      aria-label={LANGUAGE_NAMES[lang]}
      lang={lang}
      onMouseDown={editing ? focusFirstField : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-(--pn-r-3) border bg-(--pn-muted)/60 p-3 transition-[border-color,background-color,box-shadow] duration-120",
        editing
          ? "cursor-text border-[color-mix(in_oklch,var(--pn-accent)_35%,var(--pn-line))] focus-within:border-(--pn-focus) focus-within:bg-(--pn-muted) focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--pn-focus)_25%,transparent)] has-aria-invalid:border-(--pn-danger-solid)"
          : "border-transparent",
        className
      )}
    >
      <p
        aria-hidden
        className={cn(
          "flex items-center gap-1.5 text-[11px] leading-4 font-semibold tracking-[0.08em]",
          editing ? "text-(--pn-accent)" : "text-(--pn-fg-muted)"
        )}
      >
        <Languages className="size-3.5 shrink-0 text-(--pn-accent)" />
        {lang.toUpperCase()}
      </p>
      {children}
    </div>
  )
}

/** A press on the panel's padding or header lands in its first field instead of doing nothing. */
function focusFirstField(event: MouseEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest("input, textarea, button, a, [role=button]")) return
  const field = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea, input")
  if (!field || field.disabled) return
  event.preventDefault()
  field.focus()
  if (field instanceof HTMLTextAreaElement || field.type === "text") {
    field.setSelectionRange(field.value.length, field.value.length)
  }
}

/** Read-only text inside a `TranslationPanel`; `lines` clamps long descriptions in card collections. */
export function TranslationText({ children, lines }: { children: ReactNode; lines?: 4 | 5 }) {
  return (
    <p
      className={cn(
        "text-[13px] leading-5 text-pretty whitespace-pre-line text-(--pn-fg)",
        lines === 4 && "line-clamp-4",
        lines === 5 && "line-clamp-5"
      )}
    >
      {children}
    </p>
  )
}
