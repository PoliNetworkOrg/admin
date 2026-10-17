import type { LucideIcon } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { buttonMotion } from "./motion"
import { Spinner } from "./spinner"

export const buttonTones = {
  default: "",
  dangerOutline:
    "text-(--pn-danger-fg) border-[color-mix(in_oklab,var(--pn-danger-fg)_40%,transparent)] hover:border-(--pn-hover-line) hover:bg-(--pn-hover) hover:text-(--pn-accent)",
  dangerGhost: "text-(--pn-danger-fg) hover:bg-(--pn-hover) hover:text-(--pn-accent)",
  dangerSolid: "bg-(--pn-danger-solid) text-white hover:bg-(--pn-danger-solid-hover) focus-visible:ring-0",
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
