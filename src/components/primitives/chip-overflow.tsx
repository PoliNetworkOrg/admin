import type * as React from "react"
import type { ReactNode } from "react"

import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { CountBadge } from "./count-badge"
import { floatingMotion, raisedSurface } from "./motion"

type ChipOverflowProps<T> = Omit<React.ComponentProps<"div">, "children"> & {
  items: T[]
  /** Chips shown before the rest collapse into a "+n" badge. Defaults to 2, what fits a 44px row. */
  max?: number
  /** One keyed chip. */
  renderItem: (item: T) => ReactNode
  /** The item's full name in the overflow popover and its accessible label. */
  itemLabel: (item: T) => string
}

/**
 * A row of chips that never wraps, so a table row stays 44px: past `max`, a "+n" `CountBadge` lists the remaining
 * items in a hoverable popover that also opens by click or keyboard.
 */
export function ChipOverflow<T>({ items, max = 2, renderItem, itemLabel, className, ...props }: ChipOverflowProps<T>) {
  const shown = items.slice(0, max)
  const rest = items.slice(max).map(itemLabel)
  return (
    <div className={cn("flex min-w-0 flex-nowrap items-center gap-1 [&>*]:min-w-0", className)} {...props}>
      {shown.map(renderItem)}
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={100}
            closeDelay={200}
            aria-label={`Show ${rest.length} more: ${rest.join(", ")}`}
            className="shrink-0 cursor-pointer rounded-(--pn-r-full) text-(--pn-fg-muted) transition-colors duration-120 hover:bg-(--pn-accent-soft) hover:text-(--pn-accent)"
          >
            <CountBadge value={rest.length} prefix="+" className="h-[22px] min-w-[22px] bg-transparent text-inherit" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className={cn(raisedSurface, floatingMotion, "w-80 max-w-[calc(100vw-32px)] p-3")}
          >
            <PopoverTitle className="sr-only">Additional items</PopoverTitle>
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-[13px] leading-5">
              {rest.map((label, index) => (
                <li key={index} className="flex items-start gap-2 [overflow-wrap:anywhere]">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--pn-accent)" />
                  {label}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
