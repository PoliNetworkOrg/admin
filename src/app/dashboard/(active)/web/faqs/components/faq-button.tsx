import type React from "react"
import { Button } from "@/components/ui/button"

export interface FaqButtonProps {
  icon: React.ComponentType<{ className?: string }>
  onClick?: (e: React.MouseEvent) => void
  color?: string
  ariaLabel?: string
}

export function FaqButton({ icon: Icon, onClick, ariaLabel, color }: FaqButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-${color} hover:border-${color}/30 hover:bg-${color}/10 transition-all duration-200 cursor-pointer shadow-sm`}
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
