import { Maximize, Minimize } from "lucide-react"
import { useCallback, useSyncExternalStore } from "react"

import { IconButton } from "@/components/primitives/icon-button"
import { cn } from "@/lib/utils"

// Shared with the pre-paint script in __root.tsx, which sets the attribute before the first paint.
const STORAGE_KEY = "polinetwork-page-width"
const ATTRIBUTE = "data-page-width"

function readFullWidth() {
  return document.documentElement.getAttribute(ATTRIBUTE) === "full"
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] })
  return () => observer.disconnect()
}

/**
 * Whether pages drop the 1280px template width and fill the column (`full-width:` in Tailwind). One preference for
 * every page, kept in localStorage; `PageBar` and `PageContent` animate their shared edges between the two.
 */
export function usePageWidth() {
  const fullWidth = useSyncExternalStore(subscribe, readFullWidth, () => false)
  const toggleFullWidth = useCallback(() => {
    const next = !readFullWidth()
    if (next) document.documentElement.setAttribute(ATTRIBUTE, "full")
    else document.documentElement.removeAttribute(ATTRIBUTE)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "full" : "fixed")
    } catch (error) {
      console.error(error)
    }
  }, [])
  return { fullWidth, toggleFullWidth }
}

const swapIcon =
  "col-start-1 row-start-1 size-4 transition-[opacity,scale,filter] duration-200 ease-(--pn-ease-out) motion-reduce:transition-none"
const swapHidden = "scale-50 opacity-0 blur-[2px]"

/**
 * Pinned to the scrolling column's top-right corner, over the page; shown once the column is wide enough for full
 * width to gain something (`@container/column`: 1280px plus both 36px gutters, plus 48px). It sits in the right
 * gutter, clear of the scrollbar, on the page background so content scrolling under it stays hidden.
 */
export function PageWidthToggle() {
  const { fullWidth, toggleFullWidth } = usePageWidth()
  return (
    <IconButton
      label="Full width"
      icon={Maximize}
      tone={fullWidth ? "info" : "default"}
      aria-pressed={fullWidth}
      onClick={toggleFullWidth}
      tooltipSide="left"
      className="absolute top-1 right-3.5 z-20 hidden size-6 bg-(--pn-bg) @min-[1400px]/column:inline-flex"
      iconNode={
        <span aria-hidden className="grid place-items-center">
          <Maximize strokeWidth={1.75} className={cn(swapIcon, fullWidth && swapHidden)} />
          <Minimize strokeWidth={1.75} className={cn(swapIcon, !fullWidth && swapHidden)} />
        </span>
      }
    />
  )
}
