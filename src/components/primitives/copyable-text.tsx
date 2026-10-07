import type { ReactNode } from "react"

import { appToast } from "@/components/shell/toast"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

import { Hint } from "./hint"

type CopyableTextProps = {
  /** The exact text copied, e.g. the tag without its "@". */
  value: string
  /** What is copied, for the tooltip ("Copy Telegram ID") and toast ("Telegram ID copied."). */
  what: string
  /** Shown text; defaults to `value`. */
  children?: ReactNode
  className?: string
}

/** Inline text that copies `value` on click: hover brightens it with a dotted underline; result as a toast. */
export function CopyableText({ value, what, children, className }: CopyableTextProps) {
  async function copy() {
    try {
      await copyText(value)
      appToast.success(`${what} copied.`)
    } catch (error) {
      console.error(error)
      appToast.error(`The ${what.toLocaleLowerCase()} could not be copied.`)
    }
  }

  return (
    <Hint label={`Copy ${what}`}>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          "block max-w-full cursor-pointer truncate rounded-(--pn-r-1) text-left decoration-dotted underline-offset-4 transition-[color] duration-120 hover:text-(--pn-fg) hover:underline",
          className
        )}
      >
        {children ?? value}
      </button>
    </Hint>
  )
}
