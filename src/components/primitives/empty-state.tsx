import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  /** The section's panel icon. */
  icon: LucideIcon
  title: string
  text: ReactNode
  action?: ReactNode
  className?: string
}

/** "No {things} yet" / "No {things} match" + one sentence + optional action. */
export function EmptyState({ icon: Icon, title, text, action, className }: EmptyStateProps) {
  return (
    <Empty className={cn("gap-4 rounded-none border-0 p-12", className)}>
      <EmptyHeader className="max-w-[36ch] gap-2">
        <EmptyMedia className="mb-1 size-10 rounded-(--pn-r-3) bg-(--pn-muted) text-(--pn-fg-muted)">
          <Icon aria-hidden strokeWidth={1.75} className="size-5" />
        </EmptyMedia>
        <EmptyTitle className="text-lg leading-6 font-semibold tracking-[-0.01em] text-(--pn-fg)">{title}</EmptyTitle>
        <EmptyDescription className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">{text}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent className="w-auto flex-row justify-center gap-2">{action}</EmptyContent>}
    </Empty>
  )
}
