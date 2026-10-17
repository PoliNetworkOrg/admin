import type { ReactNode } from "react"

import { appToast } from "@/components/shell/toast"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

type CopyableTextProps = {
  /** The exact text copied, e.g. the tag without its "@". */
  value: string
  /** What is copied, for the accessible name ("Copy Telegram ID …") and toast ("Telegram ID copied."). */
  what: string
  /** Shown text; defaults to `value`. */
  children?: ReactNode
  className?: string
}

/** Inline text that copies `value` on click, with no visual chrome (no underline or tooltip): just the pointer and a toast. */
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
    <button
      type="button"
      aria-label={`Copy ${what} ${value}`}
      onClick={() => void copy()}
      className={cn(
        // The ::after pad gives touch a 36px target without making the line taller in stacked cards.
        "relative block max-w-full cursor-pointer rounded-(--pn-r-1) text-left max-shell:after:absolute max-shell:after:-inset-y-2 max-shell:after:-inset-x-1 max-shell:after:min-w-9",
        className
      )}
    >
      <span className="block truncate">{children ?? value}</span>
    </button>
  )
}
