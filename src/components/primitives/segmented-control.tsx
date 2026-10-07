import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import type { ReactNode } from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export type SegmentedItem<T extends string> = {
  value: T
  label: ReactNode
  /** Bare tabular number after the label (§8.5). */
  count?: number
  /** Leading glyph, e.g. a `PlatformGlyph`. */
  icon?: ReactNode
  /** Accessible name when the visible label is terse ("Set grant duration to 2h"). */
  ariaLabel?: string
}

type SegmentedControlProps<T extends string> = {
  /** Accessible name of the group. */
  label: string
  items: readonly SegmentedItem<T>[]
  /** `null` when no segment matches (shortcut groups such as grant durations). */
  value: T | null
  onValueChange: (value: T) => void
  disabled?: boolean
  id?: string
  className?: string
  itemClassName?: string
}

/**
 * 36px segmented control (§2.3) on Base UI `ToggleGroup`: a `--pn-muted` track with 32px segments; the pressed
 * one sits on the surface with a 1px line. Pressing the active segment again keeps it selected.
 */
export function SegmentedControl<T extends string>({
  label,
  items,
  value,
  onValueChange,
  disabled,
  id,
  className,
  itemClassName,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      id={id}
      aria-label={label}
      value={value === null ? [] : [value]}
      onValueChange={(next) => {
        const item = items.find((candidate) => candidate.value === next[0])
        if (item) onValueChange(item.value)
      }}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 w-fit shrink-0 items-center gap-0.5 rounded-(--pn-r-3) bg-(--pn-muted) p-0.5 data-disabled:opacity-100",
        className
      )}
    >
      {items.map((item) => (
        <Toggle
          key={item.value}
          value={item.value}
          aria-label={item.ariaLabel}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-(--pn-r-2) px-2.5 text-[13px] font-medium whitespace-nowrap text-(--pn-fg-muted) transition-[background-color,color,box-shadow] duration-120 hover:text-(--pn-fg) data-disabled:text-(--pn-fg-subtle) data-disabled:hover:text-(--pn-fg-subtle) data-pressed:bg-(--pn-surface) data-pressed:text-(--pn-fg) data-pressed:shadow-[0_0_0_1px_var(--pn-line)] dark:data-pressed:bg-(--pn-nav-active) [&_svg]:size-3.5 [&_svg]:shrink-0",
            itemClassName
          )}
        >
          {item.icon}
          {item.label}
          {item.count !== undefined && (
            <span className="text-xs font-normal text-(--pn-fg-muted) tabular-nums">{formatNumber(item.count)}</span>
          )}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
