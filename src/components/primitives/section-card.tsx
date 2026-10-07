import type { ReactNode } from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const bodyPadding = {
  default: "p-4",
  settings: "p-5",
  flush: "",
}

const headerPadding = {
  default: "px-4",
  settings: "px-5",
  flush: "px-5",
}

type SectionCardProps = {
  title?: string
  count?: number
  description?: ReactNode
  /** Right-aligned slot in the header row: a status chip or one action button. */
  action?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** `flush` lets lists and tables run edge to edge, separated by 1px lines. */
  padding?: keyof typeof bodyPadding
  className?: string
}

/** Bordered card for settings and record detail sections. */
export function SectionCard({
  title,
  count,
  description,
  action,
  children,
  footer,
  padding = "default",
  className,
}: SectionCardProps) {
  const hasHeader = title !== undefined || action !== undefined
  return (
    <section
      className={cn(
        "overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) text-(--pn-fg)",
        className
      )}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex min-h-14 items-center justify-between gap-4 py-3",
            headerPadding[padding],
            padding === "flush" && "border-b border-(--pn-line)"
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            {title !== undefined && (
              <h2 className="flex items-baseline gap-2 text-[15px] leading-[22px] font-semibold tracking-[-0.005em] text-balance">
                {title}
                {count !== undefined && (
                  <span className="text-[13px] font-normal tracking-normal text-(--pn-fg-muted) tabular-nums">
                    {formatNumber(count)}
                  </span>
                )}
              </h2>
            )}
            {description && <p className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(bodyPadding[padding], hasHeader && padding !== "flush" && "pt-0")}>{children}</div>
      {footer && <footer className={cn("border-t border-(--pn-line) py-3", headerPadding[padding])}>{footer}</footer>}
    </section>
  )
}
