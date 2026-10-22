import { useLayoutEffect, useState } from "react"

import { useShellFrame } from "@/components/shell"

/** The shortest a document area gets: on short screens the page scrolls instead. */
const MIN_HEIGHT = 480

/**
 * A height that fills the page's scroll container from the element's top down to the page's bottom padding, so the
 * area ends at the bottom of the viewport whatever sits above it (header, alerts, the phone's top bar and bottom nav).
 * Pass `ref` to the element and `style` to its `style` (or use `height`, null until measured); keep a CSS height on it
 * for the server render, before the first measurement.
 */
export function useFillHeight<T extends HTMLElement>() {
  const { main } = useShellFrame()
  const [element, setElement] = useState<T | null>(null)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!main || !element) return
    const content = element.closest<HTMLElement>("[data-page-content]")
    function measure() {
      if (!main || !element) return
      const top = element.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
      const bottom = content ? Number.parseFloat(getComputedStyle(content).paddingBottom) : 0
      setHeight(Math.max(MIN_HEIGHT, Math.floor(main.clientHeight - top - bottom)))
    }
    measure()
    // The scroll container resizes with the window; the page resizes when something above the element changes.
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    for (const child of main.children) observer.observe(child)
    return () => observer.disconnect()
  }, [main, element])

  return { ref: setElement, height, style: height === null ? undefined : { height } }
}
