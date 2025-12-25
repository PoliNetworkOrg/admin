"use client"
import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = React.HTMLAttributes<HTMLElement> & {
  block?: boolean
  copyOnClick?: boolean
}

export function Code({ block, copyOnClick, children, className }: Props) {
  const ref = useRef<HTMLElement | null>(null)

  const copy = useCallback(async () => {
    try {
      if (!ref.current) return
      await navigator.clipboard.writeText(ref.current.innerText)
      toast("Copied successfully")
    } catch (e) {
      console.error("cannot copy", e)
    }
  }, [])

  // TODO: refactor a11y
  if (block) {
    return (
      <button type="button" aria-label={`Copy code block`} onClick={copyOnClick ? copy : undefined}>
        <pre
          className={cn(
            "overflow-x-auto rounded-lg border border-gray-300 bg-gray-200 p-4 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
            copyOnClick ? "cursor-pointer" : "",
            className
          )}
        >
          <code ref={ref}>{children}</code>
        </pre>
      </button>
    )
  }

  return (
    <button type="button" aria-label={`Copy code block`} onClick={copyOnClick ? copy : undefined}>
      <code
        className={cn(
          "rounded-lg border border-gray-300 bg-gray-200 px-2 py-1 font-mono text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          copyOnClick ? "cursor-pointer" : "",
          className
        )}
        ref={ref}
      >
        {children}
      </code>
    </button>
  )
}
