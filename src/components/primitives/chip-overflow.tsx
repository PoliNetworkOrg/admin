import type * as React from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { CountBadge } from "./count-badge"
import { Hint } from "./hint"

type ChipOverflowProps<T> = Omit<React.ComponentProps<"div">, "children"> & {
  items: T[]
  /** Chips shown before the rest collapse into a "+n" badge. Defaults to 2, what fits a 44px row. */
  max?: number
  /** One keyed chip. */
  renderItem: (item: T) => ReactNode
  /** The item's name in the "+n" tooltip and its accessible label. */
  itemLabel: (item: T) => string
}

/**
 * A row of chips that never wraps, so a table row stays 44px: past `max`, a "+n" `CountBadge` lists the remaining
 * items in its tooltip.
 */
export function ChipOverflow<T>({ items, max = 2, renderItem, itemLabel, className, ...props }: ChipOverflowProps<T>) {
  const shown = items.slice(0, max)
  const rest = items.slice(max).map(itemLabel)
  return (
    <div className={cn("flex min-w-0 flex-nowrap items-center gap-1 [&>*]:min-w-0", className)} {...props}>
      {shown.map(renderItem)}
      {rest.length > 0 && (
        <Hint label={rest.join(", ")}>
          <CountBadge
            value={rest.length}
            prefix="+"
            label={`${rest.length} more: ${rest.join(", ")}`}
            tabIndex={0}
            className="h-[22px] min-w-[22px] shrink-0"
          />
        </Hint>
      )}
    </div>
  )
}
