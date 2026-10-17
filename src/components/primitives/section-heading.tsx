import type { ReactNode } from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type SectionHeadingProps = {
  title: string
  count?: number
  description?: ReactNode
  action?: ReactNode
  id?: string
  className?: string
}

/** A heading inside the page content (17px, DM Mono count), with an optional one-line description and action. */
export function SectionHeading({ title, count, description, action, id, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id={id}
          className="flex items-baseline gap-2 text-[17px] leading-6 font-semibold tracking-[-0.005em] text-balance text-(--pn-fg)"
        >
          {title}
          {count !== undefined && (
            <span className="font-mono text-xs font-normal tracking-normal text-(--pn-fg-muted) tabular-nums">
              {formatNumber(count)}
            </span>
          )}
        </h2>
        {description && <p className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
