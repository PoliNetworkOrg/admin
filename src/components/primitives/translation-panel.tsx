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
      <div className="grid gap-4 @min-[560px]:grid-cols-2">{children}</div>
    </div>
  )
}

type TranslationPanelProps = {
  lang: TranslationLanguage
  /**
   * Edit mode: the panel is the field (pair it with `bare` fields), labelled with the language's name ("Italian"):
   * a sunken box with the input border, the focus ring while a field inside has focus, and a click on the panel
   * focuses its first field.
   */
  editing?: boolean
  children: ReactNode
  className?: string
}

/**
 * One language of a bilingual text. View: a small DM Mono "IT"/"EN" tag over the text. Edit: the language name over a
 * field-like box. `lang` is set on the panel, so screen readers and the textarea spellchecker use the right language.
 */
export function TranslationPanel({ lang, editing = false, children, className }: TranslationPanelProps) {
  if (editing) {
    return (
      <div
        role="group"
        aria-label={LANGUAGE_NAMES[lang]}
        lang={lang}
        className={cn("flex min-w-0 flex-col gap-1.5", className)}
      >
        <p aria-hidden className="text-[13px] font-medium text-(--pn-fg)">
          {LANGUAGE_NAMES[lang]}
        </p>
        <div
          onMouseDown={focusFirstField}
          className="flex min-h-23 cursor-text flex-col rounded-(--pn-r-3) border border-(--pn-line-strong) bg-(--pn-sunken) px-3 py-2.5 transition-[border-color,box-shadow] duration-120 focus-within:border-(--pn-focus) focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--pn-focus)_25%,transparent)] has-aria-invalid:border-(--pn-danger-solid)"
        >
          {children}
        </div>
      </div>
    )
  }
  return (
    <div
      role="group"
      aria-label={LANGUAGE_NAMES[lang]}
      lang={lang}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      <span
        aria-hidden
        className="inline-flex h-4.5 items-center self-start rounded-(--pn-r-1) border border-(--pn-line) px-1.25 font-mono text-[10px] tracking-[0.06em] text-(--pn-fg-muted)"
      >
        {lang.toUpperCase()}
      </span>
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
        "text-[13px] leading-[1.55] text-pretty whitespace-pre-line text-(--pn-fg)",
        lines === 4 && "line-clamp-4",
        lines === 5 && "line-clamp-5"
      )}
    >
      {children}
    </p>
  )
}
