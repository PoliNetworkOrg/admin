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
  tone?: "default" | "info" | "success" | "warning" | "danger"
  appearance?: "ghost" | "tinted"
  pending?: boolean
  iconClassName?: string
  tooltipSide?: "top" | "bottom" | "left" | "right"
}

const toneClasses = {
  default: "hover:bg-(--pn-muted) hover:text-(--pn-fg) aria-expanded:bg-(--pn-muted) aria-expanded:text-(--pn-fg)",
  info: "text-(--pn-info-fg) hover:bg-(--pn-info-bg) hover:text-(--pn-info-fg)",
  success: "text-(--pn-success-fg) hover:bg-(--pn-success-bg) hover:text-(--pn-success-fg)",
  warning: "text-(--pn-warning-fg) hover:bg-(--pn-warning-bg) hover:text-(--pn-warning-fg)",
  danger: "hover:bg-(--pn-danger-bg) hover:text-(--pn-danger-fg)",
}

const tintedToneClasses = {
  default: "",
  info: "[--pn-icon-fg:var(--pn-action-blue)] [--pn-icon-tint:var(--pn-action-blue)]",
  success: "[--pn-icon-fg:var(--pn-action-green)] [--pn-icon-tint:var(--pn-action-green-tint)]",
  warning: "[--pn-icon-fg:var(--pn-action-amber)] [--pn-icon-tint:var(--pn-action-amber-tint)]",
  danger: "[--pn-icon-fg:var(--pn-action-red)] [--pn-icon-tint:var(--pn-action-red)]",
}

/** 36px icon button with matching `aria-label` and tooltip; group actions opt into tinted colors. */
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
          appearance === "tinted" && ["border-(--pn-line-strong)", tintedToneClasses[tone]],
          appearance === "tinted" &&
            tone !== "default" &&
            "border-[color-mix(in_oklch,var(--pn-icon-fg)_18%,var(--pn-line-strong))] bg-[color-mix(in_oklch,var(--pn-icon-tint)_5%,transparent)] text-(--pn-icon-fg) hover:border-[color-mix(in_oklch,var(--pn-icon-fg)_30%,transparent)] hover:bg-[color-mix(in_oklch,var(--pn-icon-tint)_14%,transparent)] hover:text-(--pn-icon-fg) dark:hover:bg-[color-mix(in_oklch,var(--pn-icon-tint)_16%,transparent)]",
          className
        )}
        {...props}
      >
        {pending ? <Spinner /> : <Icon aria-hidden className={cn("size-4", iconClassName)} />}
      </Button>
    </Hint>
  )
}
