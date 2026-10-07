import { useRender } from "@base-ui/react/use-render"
import { ChevronRight } from "lucide-react"
import type { ReactElement, ReactNode } from "react"

import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

type NavCardProps = {
  title: string
  count?: number
  /** Singular noun for `count`, e.g. "category" → "12 categories". Without it the count is a bare number. */
  noun?: string
  description?: ReactNode
  href?: string
  /** Custom link element (e.g. a router `Link`). Without `href`/`render` the card is a button. */
  render?: ReactElement
  onClick?: () => void
  className?: string
}

/** One 56px link card: name, count, chevron. The whole card is the hit area. */
export function NavCard({ title, count, noun, description, href, render, onClick, className }: NavCardProps) {
  const fallback = href === undefined ? <button type="button" /> : <a href={href} />
  return useRender({
    defaultTagName: "a",
    render: render ?? fallback,
    props: {
      className: cn(
        "group/nav-card flex min-h-14 w-full items-center gap-3 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) px-4 py-3 text-left text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-muted)",
        className
      ),
      onClick: onClick && (() => onClick()),
      children: (
        <>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm leading-5 font-medium">{title}</span>
            {description && <span className="text-xs leading-4 text-pretty text-(--pn-fg-muted)">{description}</span>}
          </span>
          {count !== undefined && (
            <span className="shrink-0 text-xs whitespace-nowrap text-(--pn-fg-muted) tabular-nums">
              {noun === undefined ? count : pluralize(count, noun)}
            </span>
          )}
          <ChevronRight aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
        </>
      ),
    },
  })
}
