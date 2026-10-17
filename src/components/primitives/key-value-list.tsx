import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { Unset } from "./unset"

export type KeyValueItem = {
  key: string
  /** `null`/`undefined` render as `—`. */
  value: ReactNode
  mono?: boolean
  hint?: ReactNode
}

type KeyValueListProps = {
  items: KeyValueItem[]
  orientation?: "vertical" | "horizontal"
  className?: string
}

function Value({ item }: { item: KeyValueItem }) {
  return (
    <dd className="flex min-w-0 flex-col gap-0.5">
      <span className={cn("min-w-0 text-[13px] leading-5 text-(--pn-fg)", item.mono && "font-mono tabular-nums")}>
        {item.value ?? <Unset />}
      </span>
      {item.hint && <span className="text-xs text-(--pn-fg-muted)">{item.hint}</span>}
    </dd>
  )
}

/**
 * Read-only values. Vertical: one row per item with a 120px key column, or the key above the value in containers
 * narrower than 352px. Horizontal: items inline on one row.
 */
export function KeyValueList({ items, orientation = "vertical", className }: KeyValueListProps) {
  if (orientation === "horizontal") {
    return (
      <dl className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <dt className="text-[13px] leading-5 font-medium text-(--pn-fg-muted)">{item.key}</dt>
            <Value item={item} />
          </div>
        ))}
      </dl>
    )
  }

  // Narrower than 352px (phone cards) the key sits above its value, so values like emails get the full width.
  return (
    <div className={cn("@container", className)}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 @min-[22rem]:grid-cols-[120px_minmax(0,1fr)]">
        {items.map((item) => (
          <div
            key={item.key}
            className="grid gap-y-0.5 @min-[22rem]:col-span-2 @min-[22rem]:grid-cols-subgrid @min-[22rem]:items-baseline @min-[22rem]:gap-y-0"
          >
            <dt className="text-[13px] leading-5 font-medium text-(--pn-fg-muted)">{item.key}</dt>
            <Value item={item} />
          </div>
        ))}
      </dl>
    </div>
  )
}
