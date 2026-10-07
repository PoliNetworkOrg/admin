import type { ReactElement, ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const tooltipMotion =
  "bg-(--pn-fg) text-(--pn-bg) duration-120 ease-(--pn-ease-out) data-closed:duration-80 data-closed:ease-(--pn-ease-in) [--tw-enter-scale:1]! [--tw-exit-scale:1]! data-[side=top]:[--tw-enter-translate-y:4px]! data-[side=bottom]:[--tw-enter-translate-y:-4px]! data-[side=left]:[--tw-enter-translate-x:4px]! data-[side=right]:[--tw-enter-translate-x:-4px]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!"

type HintProps = {
  label: ReactNode
  children: ReactElement
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

/** Tooltip around a single trigger element; the trigger keeps its own `aria-label`. */
export function Hint({ label, children, side = "top", className }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} sideOffset={6} className={cn(tooltipMotion, className)}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
