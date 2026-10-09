import type { ReactNode, Ref } from "react"

import { cn } from "@/lib/utils"

import { LabelDot } from "./label-chip"

type RecordHeaderProps = {
  title: string
  avatar?: ReactNode
  /** Label color; renders the 8px dot before the title. */
  dot?: string
  meta?: ReactNode
  description?: ReactNode
  chips?: ReactNode
  actions?: ReactNode
  /** Observed by the shell's `ScrollTitle`. */
  titleRef?: Ref<HTMLHeadingElement>
  className?: string
}

/** The only `h1` on a deep page. */
export function RecordHeader({
  title,
  avatar,
  dot,
  meta,
  description,
  chips,
  actions,
  titleRef,
  className,
}: RecordHeaderProps) {
  return (
    <header className={cn("flex items-start gap-4", className)}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1
          ref={titleRef}
          className="flex items-center gap-2 text-xl leading-7 font-semibold tracking-[-0.015em] text-balance text-(--pn-fg)"
        >
          {dot && <LabelDot color={dot} />}
          {title}
        </h1>
        {meta && <div className="text-[13px] leading-5 text-(--pn-fg-muted)">{meta}</div>}
        {description && <p className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">{description}</p>}
        {chips && <div className="mt-2 flex flex-wrap items-center gap-2">{chips}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
