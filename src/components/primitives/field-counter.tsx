import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export function isCounterVisible(length: number, max: number): boolean {
  return length >= max * 0.8
}

type FieldCounterProps = { length: number; max: number; id?: string; className?: string }

/** "148/160", shown only in the last 20% of `max`. */
export function FieldCounter({ length, max, id, className }: FieldCounterProps) {
  if (!isCounterVisible(length, max)) return null
  return (
    <span
      id={id}
      aria-live="polite"
      className={cn("text-xs text-(--pn-fg-muted) tabular-nums", length >= max && "text-(--pn-danger-fg)", className)}
    >
      {formatNumber(length)}/{formatNumber(max)}
    </span>
  )
}
