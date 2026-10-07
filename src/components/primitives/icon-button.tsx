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
  tone?: "default" | "danger"
  pending?: boolean
  iconClassName?: string
  tooltipSide?: "top" | "bottom" | "left" | "right"
}

const toneClasses = {
  default: "hover:bg-(--pn-muted) hover:text-(--pn-fg) aria-expanded:bg-(--pn-muted) aria-expanded:text-(--pn-fg)",
  danger: "hover:bg-(--pn-danger-bg) hover:text-(--pn-danger-fg)",
}

/** 36px ghost icon button with matching `aria-label` and tooltip. */
export function IconButton({
  label,
  ariaLabel,
  icon: Icon,
  tone = "default",
  pending = false,
  disabled,
  className,
  iconClassName,
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
        disabled={disabled || pending}
        className={cn(
          buttonMotion,
          "text-(--pn-fg-muted) active:not-aria-[haspopup]:translate-y-0 disabled:text-(--pn-fg-subtle) data-disabled:text-(--pn-fg-subtle) data-disabled:hover:bg-transparent",
          toneClasses[tone],
          className
        )}
        {...props}
      >
        {pending ? <Spinner /> : <Icon aria-hidden className={cn("size-4", iconClassName)} />}
      </Button>
    </Hint>
  )
}
