import type * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { floatingMotion, raisedSurface } from "./motion"

const itemClasses =
  "h-9 gap-2 rounded-(--pn-r-2) px-2 text-[13px] text-(--pn-fg) focus:bg-(--pn-muted) focus:text-(--pn-fg) not-data-[variant=destructive]:focus:**:text-(--pn-fg) data-[variant=destructive]:text-(--pn-danger-fg) data-[variant=destructive]:focus:bg-(--pn-danger-bg) data-[variant=destructive]:focus:text-(--pn-danger-fg) [&_svg]:text-(--pn-fg-muted)"

/** Raised menu surface: `--pn-r-4`, floating shadow, 160/120ms scale from the trigger. Aligns end by default. */
export function MenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      className={cn(raisedSurface, floatingMotion, "w-auto min-w-44 rounded-(--pn-r-4) p-1", className)}
      {...props}
    />
  )
}

/** 36px, 13px item; highlighted on `--pn-muted`. */
export function MenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem className={cn(itemClasses, className)} {...props} />
}

/** Radio item with the check on the right. */
export function MenuRadioItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuRadioItem>) {
  return <DropdownMenuRadioItem className={cn(itemClasses, "pr-8", className)} {...props} />
}

/** 12px muted group heading. */
export function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuLabel>) {
  return <DropdownMenuLabel className={cn("px-2 py-1.5 text-xs text-(--pn-fg-muted)", className)} {...props} />
}

export function MenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator className={cn("bg-(--pn-line)", className)} {...props} />
}

export {
  DropdownMenu as Menu,
  DropdownMenuGroup as MenuGroup,
  DropdownMenuRadioGroup as MenuRadioGroup,
  DropdownMenuTrigger as MenuTrigger,
}
