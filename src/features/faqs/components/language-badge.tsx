import type React from "react"

import { cn } from "@/lib/utils"

export interface LanguageBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  lang: "it" | "en"
}

export function LanguageBadge({ lang, className, ...props }: LanguageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[10px] font-semibold text-muted-foreground/80 tracking-wider uppercase bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 shrink-0 leading-none select-none",
        className
      )}
      {...props}
    >
      {lang.toUpperCase()}
    </span>
  )
}
