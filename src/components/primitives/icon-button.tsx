import type { LucideIcon } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { Hint } from "./hint"
import { buttonMotion } from "./motion"
import { Spinner } from "./spinner"

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, "size" | "variant" | "children" | "aria-label"> & {
  /** Tooltip text; also the `aria-label` unless `ariaLabel` is given. */
  label: string
  /** Names the record for screen readers ("Leave Analisi 1") while the tooltip stays short ("Leave group"). */
  ariaLabel?: string
  icon: LucideIcon
  /**
   * Icons are monochrome at rest. `danger`, `success` and `warning` share the brand-blue hover; `info` marks an "on" state
   * (a visible group) with the accent color.
   */
  tone?: "default" | "info" | "success" | "warning" | "danger"
  /** `boxed` draws a bordered 36px button on the surface, for actions outside tables (group member add/remove). */
  appearance?: "ghost" | "boxed"
  pending?: boolean
  iconClassName?: string
  /** Custom icon content, e.g. an animated icon swap; replaces `icon` (still required as the resting icon's type). */
  iconNode?: React.ReactNode
  tooltipSide?: "top" | "bottom" | "left" | "right"
}

const toneClasses = {
  default:
    "hover:bg-(--pn-accent-soft) hover:text-(--pn-fg) aria-expanded:bg-(--pn-muted) aria-expanded:text-(--pn-fg)",
  info: "text-(--pn-accent) hover:bg-(--pn-accent-soft) hover:text-(--pn-accent)",
  success: "hover:bg-(--pn-accent-soft) hover:text-(--pn-accent)",
  warning: "hover:bg-(--pn-accent-soft) hover:text-(--pn-accent)",
  danger: "hover:bg-(--pn-accent-soft) hover:text-(--pn-accent)",
}

const boxedClasses = "border border-(--pn-line) bg-(--pn-surface) text-(--pn-fg) hover:border-(--pn-accent)"

/** 36px monochrome icon button with matching `aria-label` and tooltip. */
export function IconButton({
  label,
  ariaLabel,
  icon: Icon,
  tone = "default",
  appearance = "ghost",
  pending = false,
  disabled,
  className,
  iconClassName,
  iconNode,
  tooltipSide,
  ...props
}: IconButtonProps) {
  return (
    <Hint label={label} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={ariaLabel ?? label}
        aria-busy={pending || undefined}
        data-tone={tone}
        data-appearance={appearance}
        disabled={disabled || pending}
        className={cn(
          buttonMotion,
          "text-(--pn-fg-muted) active:not-aria-[haspopup]:translate-y-0 disabled:text-(--pn-fg-subtle) data-disabled:text-(--pn-fg-subtle) data-disabled:hover:bg-transparent data-disabled:hover:text-(--pn-fg-subtle)",
          toneClasses[tone],
          appearance === "boxed" && boxedClasses,
          className
        )}
        {...props}
      >
        {pending ? (
          <Spinner />
        ) : (
          (iconNode ?? <Icon aria-hidden strokeWidth={1.75} className={cn("size-4.5", iconClassName)} />)
        )}
      </Button>
    </Hint>
  )
}
