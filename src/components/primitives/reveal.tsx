import { type ReactNode, useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/** The longer of the two transitions below. */
const CLOSE_MS = 200

type RevealProps = {
  open: boolean
  children: ReactNode
  /** Mounts the children only while open (and while closing), so long collapsed lists cost nothing. */
  lazy?: boolean
  className?: string
}

/** Collapsible region: `grid-template-rows` 0fr → 1fr (200ms) plus a 150ms fade; collapsed content is inert. */
export function Reveal({ open, children, lazy = false, className }: RevealProps) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (!lazy || open || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [lazy, open, mounted])

  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] ease-(--pn-ease-move) [transition-duration:200ms,150ms]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{!lazy || mounted ? children : null}</div>
    </div>
  )
}
