import type * as React from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

type CountBadgeProps = Omit<React.ComponentProps<"span">, "children" | "aria-label"> & {
  value: number
  /** "×3" for grouped duplicates, "+3" for overflow ("3 more"). */
  prefix?: "×" | "+"
  /** Accessible text, e.g. "3 reports". Defaults to the visible text. */
  label?: string
}

/** Neutral pill with a tabular number; spreads span props so it can be a tooltip trigger. */
export function CountBadge({ value, prefix, label, className, ...props }: CountBadgeProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-(--pn-r-full) bg-(--pn-muted) px-1.5 text-xs font-medium text-(--pn-fg-muted) tabular-nums",
        className
      )}
      {...props}
    >
      {prefix}
      {formatNumber(value)}
    </span>
  )
}
