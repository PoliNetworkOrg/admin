"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface WebHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    icon?: ReactNode
    onClick: () => void
  }
}

export default function WebHeader({ title, description, action }: WebHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
          {title}
        </h1>
        {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
      </div>
      {action && (
        <Button className="shrink-0" onClick={action.onClick}>
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  )
}
