import { cn } from "@/lib/utils"

import { getGroupLabelColor } from "./group-labels.constants"

export function LabelDot({ color, className }: { color: string; className?: string }) {
  const swatch = getGroupLabelColor(color)
  return <span className={cn("size-2 shrink-0 rounded-full", swatch.dotClassName, className)} style={swatch.dotStyle} />
}
