import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const sizes = {
  default: "h-[22px] px-2 text-xs",
  tiny: "h-[18px] px-1.5 text-[11px] leading-none",
}

type ChipProps = Omit<React.ComponentProps<typeof Badge>, "variant"> & { size?: keyof typeof sizes }

/** Categorical value (role, license, language): outlined, no dot. */
export function Chip({ size = "default", className, ...props }: ChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-(--pn-r-full) border-(--pn-line) bg-transparent font-medium text-(--pn-fg) transition-[background-color,color,border-color] duration-120 [a]:hover:bg-(--pn-muted) [a]:hover:text-(--pn-fg)",
        sizes[size],
        className
      )}
      {...props}
    />
  )
}
