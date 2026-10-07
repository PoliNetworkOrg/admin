import { useRender } from "@base-ui/react/use-render"
import type { ReactElement } from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type StatTileProps = {
  label: string
  /** `null` when the count couldn't be loaded: the tile shows `—`. */
  value: number | null
  href?: string
  /** Custom link element (e.g. a router `Link`). */
  render?: ReactElement
  className?: string
}

/** Overview number tile; the whole tile links to its section. */
export function StatTile({ label, value, href, render, className }: StatTileProps) {
  return useRender({
    defaultTagName: "a",
    render: render ?? <a href={href} />,
    props: {
      className: cn(
        "flex flex-col gap-1 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) p-4 text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-muted)",
        className
      ),
      children: (
        <>
          {value === null ? (
            <span
              role="img"
              aria-label="Couldn't load"
              className="text-[28px] leading-8 font-semibold text-(--pn-fg-muted)"
            >
              —
            </span>
          ) : (
            <span className="text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">
              {formatNumber(value)}
            </span>
          )}
          <span className="text-xs leading-4 text-(--pn-fg-muted)">{label}</span>
        </>
      ),
    },
  })
}
