import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type AlertTone = "neutral" | "info" | "success" | "warning" | "danger"

const tones = {
  neutral: { icon: Info, surface: "bg-(--pn-muted) text-(--pn-fg)", glyph: "text-(--pn-fg-muted)" },
  info: { icon: Info, surface: "bg-(--pn-info-bg) text-(--pn-fg)", glyph: "text-(--pn-info-fg)" },
  success: { icon: CircleCheck, surface: "bg-(--pn-success-bg) text-(--pn-fg)", glyph: "text-(--pn-success-fg)" },
  warning: { icon: TriangleAlert, surface: "bg-(--pn-warning-bg) text-(--pn-fg)", glyph: "text-(--pn-warning-fg)" },
  danger: { icon: CircleX, surface: "bg-(--pn-danger-bg) text-(--pn-fg)", glyph: "text-(--pn-danger-fg)" },
}

type InlineAlertProps = {
  tone?: AlertTone
  children: ReactNode
  action?: ReactNode
  className?: string
}

/** Persistent load errors, dialog submit errors, partial-save warnings. Never for success. */
export function InlineAlert({ tone = "danger", children, action, className }: InlineAlertProps) {
  const { icon: Icon, surface, glyph } = tones[tone]
  const urgent = tone === "danger" || tone === "warning"
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-(--pn-r-3) p-3 text-[13px] leading-5", surface, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", glyph)} />
      <div className="min-w-0 flex-1 text-pretty">{children}</div>
      {action && <div className="-my-1.5 flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
