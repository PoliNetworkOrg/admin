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

/** Read-only values. Vertical: one row per item with a 120px key column. Horizontal: items inline on one row. */
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

  return (
    <dl className={cn("grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3", className)}>
      {items.map((item) => (
        <div key={item.key} className="col-span-2 grid grid-cols-subgrid items-baseline">
          <dt className="text-[13px] leading-5 font-medium text-(--pn-fg-muted)">{item.key}</dt>
          <Value item={item} />
        </div>
      ))}
    </dl>
  )
}
