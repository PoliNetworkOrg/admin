import { cn } from "@/lib/utils"

type SectionEmptyProps = {
  /** "No {things}" (empty-state title formula, no trailing period). */
  title: string
  /** One sentence: what appears here and how it gets there. */
  hint?: string
  className?: string
}

/**
 * The empty state of one section inside a page (a card, a collapsible, a list slot): 13px muted title and an
 * optional 12px hint, centred. Page-level empties use `EmptyState`.
 */
export function SectionEmpty({ title, hint, className }: SectionEmptyProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 px-5 py-8 text-center", className)}>
      <p className="text-[13px] leading-5 text-balance text-(--pn-fg-muted)">{title}</p>
      {hint && <p className="max-w-[44ch] text-xs text-pretty text-(--pn-fg-muted)">{hint}</p>}
    </div>
  )
}
