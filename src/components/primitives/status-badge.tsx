import type * as React from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger"

const tones = {
  neutral: { badge: "bg-(--pn-muted) text-(--pn-fg-muted)", dot: "bg-(--pn-fg-muted)" },
  brand: { badge: "bg-(--pn-info-bg) text-(--pn-info-fg)", dot: "bg-(--pn-accent)" },
  success: { badge: "bg-(--pn-success-bg) text-(--pn-success-fg)", dot: "bg-(--pn-success-solid)" },
  warning: { badge: "bg-(--pn-warning-bg) text-(--pn-warning-fg)", dot: "bg-(--pn-warning-solid)" },
  danger: { badge: "bg-(--pn-danger-bg) text-(--pn-danger-fg)", dot: "bg-(--pn-danger-solid)" },
} satisfies Record<StatusTone, { badge: string; dot: string }>

type StatusBadgeProps = React.ComponentProps<"span"> & { tone: StatusTone }

/** States only (Active, Pending, Draft…). Categorical values use `Chip`. */
export function StatusBadge({ tone, className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-(--pn-r-full) px-2 text-xs font-medium whitespace-nowrap",
        tones[tone].badge,
        className
      )}
      {...props}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tones[tone].dot)} />
      {children}
    </span>
  )
}
