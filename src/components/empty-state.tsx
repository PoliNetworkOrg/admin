import type { LucideIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Empty className="rounded-xl border border-dashed border-border bg-card px-5 py-14">
      <EmptyHeader className="gap-2">
        <EmptyMedia variant="icon" className="mb-0 text-primary">
          <Icon className="size-7" />
        </EmptyMedia>
        <EmptyTitle className="text-base font-semibold tracking-[-0.02em]">{title}</EmptyTitle>
        <EmptyDescription className="max-w-sm text-sm leading-6">{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
