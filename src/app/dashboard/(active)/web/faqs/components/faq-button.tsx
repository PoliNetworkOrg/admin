import type React from "react"
import { Button } from "@/components/ui/button"

export interface FaqButtonProps {
  icon: React.ComponentType<{ className?: string }>
  onClick?: (e: React.MouseEvent) => void
  color?: "destructive" | "primary" | "emerald" | string
  ariaLabel?: string
}

const colorVariants: Record<string, string> = {
  destructive: "hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10",
  primary: "hover:text-primary hover:border-primary/30 hover:bg-primary/10",
  emerald: "hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/10",
}

export function FaqButton({ icon: Icon, onClick, ariaLabel, color = "primary" }: FaqButtonProps) {
  const hoverStyles = colorVariants[color] ?? "hover:text-primary hover:border-primary/30 hover:bg-primary/10"

  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground ${hoverStyles} transition-all duration-200 cursor-pointer shadow-sm`}
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
