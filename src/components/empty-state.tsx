import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <Empty className="rounded-xl border border-dashed border-border bg-card px-5 py-14 shadow-[0_1px_2px_rgb(15_23_42/3%)] dark:shadow-none">
      <EmptyHeader className="gap-2">
        <EmptyMedia variant="icon" className="mb-1 size-10 rounded-lg bg-accent text-primary">
          <Icon className="size-5" />
        </EmptyMedia>
        <EmptyTitle className="text-base font-semibold tracking-[-0.02em]">{title}</EmptyTitle>
        <EmptyDescription className="max-w-sm text-sm leading-6">{text}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
