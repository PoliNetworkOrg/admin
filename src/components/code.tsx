"use client"

import { type MouseEvent, type ReactNode, useCallback, useRef } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = React.HTMLAttributes<HTMLElement> & {
  block?: boolean
  copyOnClick?: boolean
  children: ReactNode
}

export function Code({ block = false, copyOnClick = false, children, className, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null)

  const copy = useCallback(async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    try {
      if (!ref.current) return
      await navigator.clipboard.writeText(ref.current.innerText)
      toast.success("Copied to clipboard")
    } catch (err) {
      console.error("Failed to copy code:", err)
      toast.error("Failed to copy code")
    }
  }, [])

  const InteractiveWrapper = copyOnClick
    ? ({ children: content }: { children: ReactNode }) => (
      <button
        type="button"
        onClick={copy}
        className={cn(
          "appearance-none border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          block ? "block w-full" : "inline"
        )}
        aria-label={block ? "Copy code block" : "Copy code"}
      >
        {content}
      </button>
    )
    : ({ children: content }: { children: ReactNode }) => <>{content}</>

  if (block) {
    return (
      <InteractiveWrapper>
        <pre
          className={cn(
            "overflow-x-auto rounded-lg border border-gray-300 bg-gray-200 p-4 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
            copyOnClick && "cursor-pointer",
            className
          )}
        >
          <code ref={ref} {...rest}>
            {children}
          </code>
        </pre>
      </InteractiveWrapper>
    )
  }

  return (
    <InteractiveWrapper>
      <code
        ref={ref}
        className={cn(
          "rounded border border-gray-300 bg-gray-200 px-2 py-1 font-mono text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          copyOnClick && "cursor-pointer",
          className
        )}
        {...rest}
      >
        {children}
      </code>
    </InteractiveWrapper>
  )
}
