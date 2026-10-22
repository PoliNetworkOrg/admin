import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A shortcut hint inside a button; hidden on coarse pointers, where there is no keyboard. */
export function Kbd({ children, onSolid = false }: { children: ReactNode; onSolid?: boolean }) {
  return (
    <kbd
      aria-hidden
      className={cn(
        "rounded-[5px] border px-1.5 font-mono text-[11px] leading-4 pointer-coarse:hidden",
        onSolid
          ? "border-current bg-transparent text-inherit opacity-70"
          : "border-(--pn-line-strong) bg-(--pn-surface-raised) text-(--pn-fg-muted)"
      )}
    >
      {children}
    </kbd>
  )
}
