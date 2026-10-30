import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

/**
 * A field without a visible box at rest (the composer's title and roles): it reads as text, shows a border on hover
 * and the input focus ring when focused.
 */
export const quietField =
  "border-transparent bg-transparent shadow-none hover:border-(--pn-hover-line) dark:bg-transparent disabled:bg-transparent"

/** A problem shown at the control it is about, styled like `FormField`'s error. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-(--pn-danger-fg)">
      <CircleAlert aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}
