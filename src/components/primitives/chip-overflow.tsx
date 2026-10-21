import type * as React from "react"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"

import { CustomScrollbar } from "@/components/primitives/custom-scrollbar"
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
  /** The text the chip shows, when shorter than `itemLabel`; sizes the fit. */
  chipText?: (item: T) => string
}

/** Estimated chip geometry (12px DM Sans): padding and dot, average glyph width, the chip's max width. */
const CHIP_CHROME = 26
const CHIP_GLYPH = 6.4
const CHIP_MAX = 224
/** The narrowest a chip may truncate to and still show a readable start of its name. */
const CHIP_MIN = 72
const GAP = 4
const BADGE = 30

/** How many chips fit `width` before the "+n" badge, never truncating one below `CHIP_MIN`; at least one. */
function fittingCount(labels: string[], max: number, width: number) {
  let used = 0
  let count = 0
  for (const label of labels.slice(0, max)) {
    const natural = Math.min(CHIP_MAX, CHIP_CHROME + label.length * CHIP_GLYPH)
    const reserve = count + 1 < labels.length ? GAP + BADGE : 0
    const room = width - used - (count > 0 ? GAP : 0) - reserve
    if (room < Math.min(natural, CHIP_MIN)) break
    used += (count > 0 ? GAP : 0) + Math.min(natural, room)
    count += 1
  }
  return Math.max(1, count)
}

/**
 * A row of chips that never wraps, so a table row stays 44px: past `max`, or past what fits the cell without
 * truncating a chip to a stub, a "+n" `CountBadge` lists the remaining items in a hoverable popover that also opens
 * by click or keyboard.
 */
export function ChipOverflow<T>({
  items,
  max = 2,
  renderItem,
  itemLabel,
  chipText = itemLabel,
  className,
  ...props
}: ChipOverflowProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const count = width === null ? max : Math.min(max, fittingCount(items.map(chipText), max, width))
  const shown = items.slice(0, count)
  const rest = items.slice(count).map(itemLabel)
  return (
    <div
      ref={ref}
      className={cn("flex w-full min-w-0 flex-nowrap items-center gap-1 [&>*]:min-w-0", className)}
      {...props}
    >
      {shown.map(renderItem)}
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={100}
            closeDelay={200}
            aria-label={`Show ${rest.length} more: ${rest.join(", ")}`}
            className="shrink-0 cursor-pointer rounded-(--pn-r-full) text-(--pn-fg-muted) transition-colors duration-120 hover:bg-(--pn-hover) hover:text-(--pn-accent)"
          >
            <CountBadge value={rest.length} prefix="+" className="h-[22px] min-w-[22px] bg-transparent text-inherit" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className={cn(
              raisedSurface,
              floatingMotion,
              "w-80 max-w-[calc(100vw-32px)] rounded-(--pn-r-3) border border-(--pn-line) p-3"
            )}
          >
            <PopoverTitle className="sr-only">Additional items</PopoverTitle>
            <CustomScrollbar as="ul" className="max-h-72" viewportClassName="flex flex-col gap-2 text-[13px] leading-5">
              {rest.map((label, index) => (
                <li key={index} className="flex items-start gap-2 [overflow-wrap:anywhere]">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--pn-accent)" />
                  {label}
                </li>
              ))}
            </CustomScrollbar>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
