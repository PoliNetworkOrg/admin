import { cn } from "@/lib/utils"

/** The em dash that stands in for every absent value. */
export function Unset({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Not set" data-unset="" className={cn("text-(--pn-fg-muted)", className)}>
      —
    </span>
  )
}
