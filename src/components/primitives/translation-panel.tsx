import { Languages } from "lucide-react"
import type { ReactNode } from "react"

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
  /** Edit mode: accent border (stronger while a field inside has focus) and accent label. */
  editing?: boolean
  children: ReactNode
  className?: string
}

/**
 * One language of a bilingual text (§5.14): a `Languages` icon + "IT"/"EN" header over the content. `lang` is set on
 * the panel, so screen readers and the textarea spellchecker use the right language.
 */
export function TranslationPanel({ lang, editing = false, children, className }: TranslationPanelProps) {
  return (
    <div
      role="group"
      aria-label={LANGUAGE_NAMES[lang]}
      lang={lang}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-(--pn-r-3) border p-3 transition-[border-color] duration-120",
        editing
          ? "border-[color-mix(in_oklch,var(--pn-accent)_28%,var(--pn-line))] bg-(--pn-surface) focus-within:border-[color-mix(in_oklch,var(--pn-accent)_60%,var(--pn-line))]"
          : "border-transparent bg-(--pn-muted)/60",
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
