import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type RevealProps = { open: boolean; children: ReactNode; className?: string }

/** Collapsible region: `grid-template-rows` 0fr → 1fr (200ms) plus a 150ms fade; collapsed content is inert. */
export function Reveal({ open, children, className }: RevealProps) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] ease-(--pn-ease-move) [transition-duration:200ms,150ms]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
