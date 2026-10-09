import type { ReactElement, ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const tooltipMotion =
  "bg-(--pn-fg) text-(--pn-bg) duration-120 ease-(--pn-ease-out) data-closed:duration-80 data-closed:ease-(--pn-ease-in) [--tw-enter-scale:1]! [--tw-exit-scale:1]! data-[side=top]:[--tw-enter-translate-y:4px]! data-[side=bottom]:[--tw-enter-translate-y:-4px]! data-[side=left]:[--tw-enter-translate-x:4px]! data-[side=right]:[--tw-enter-translate-x:-4px]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!"

/** Default open delay, set once on the shell's `TooltipProvider`: short enough to feel immediate, long enough not to flash while the pointer crosses a row. */
export const TOOLTIP_DELAY = 100
/** Opt-in for triggers the pointer sweeps across on the way elsewhere (the rail), where instant tooltips would be noise. */
export const TOOLTIP_DELAY_SLOW = 400

type HintProps = {
  label: ReactNode
  children: ReactElement
  /** Overrides the provider delay; pass `TOOLTIP_DELAY_SLOW` only where the pointer often passes over the trigger. */
  delay?: number
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

/** Tooltip around a single trigger element; the trigger keeps its own `aria-label`. */
export function Hint({ label, children, side = "top", delay, className }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} delay={delay} />
      <TooltipContent side={side} sideOffset={6} className={cn(tooltipMotion, className)}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
