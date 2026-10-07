import type { LucideIcon } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { buttonMotion } from "./motion"
import { Spinner } from "./spinner"

export const buttonTones = {
  default: "",
  dangerOutline:
    "text-(--pn-danger-fg) border-[color-mix(in_oklch,var(--pn-danger-fg)_40%,transparent)] hover:border-[color-mix(in_oklch,var(--pn-danger-fg)_60%,transparent)] hover:bg-(--pn-danger-bg) hover:text-(--pn-danger-fg)",
  dangerGhost: "text-(--pn-danger-fg) hover:bg-(--pn-danger-bg) hover:text-(--pn-danger-fg)",
  dangerSolid:
    "bg-(--pn-danger-solid) text-white hover:bg-[color-mix(in_oklch,var(--pn-danger-solid),black_10%)] focus-visible:ring-0",
}

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean
  icon?: LucideIcon
  tone?: keyof typeof buttonTones
}

/** Text button whose leading icon becomes a spinner while `pending`; the label never changes. */
export function LoadingButton({
  pending = false,
  icon: Icon,
  tone = "default",
  size = "sm",
  disabled,
  className,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      size={size}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(buttonMotion, buttonTones[tone], className)}
      {...props}
    >
      {pending ? <Spinner data-icon="inline-start" /> : Icon && <Icon aria-hidden data-icon="inline-start" />}
      {children}
    </Button>
  )
}
