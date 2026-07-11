import type { LucideIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Empty className="rounded-none border border-dashed bg-white/45 px-5 py-14">
      <EmptyHeader className="gap-2">
        <EmptyMedia variant="default" className="mb-0 text-primary">
          <Icon className="size-7" />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-lg font-normal tracking-[-0.04em]">{title}</EmptyTitle>
        <EmptyDescription className="max-w-[340px] text-[11px] leading-[1.5]">{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
