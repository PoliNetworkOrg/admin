import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

/** Reloads the page's data every `ms` while `active`, one reload at a time, skipping ticks while the tab is hidden. */
export function useReloadWhile(active: boolean, ms: number) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    let busy = false
    const timer = window.setInterval(() => {
      if (busy || document.visibilityState === "hidden") return
      busy = true
      router
        .invalidate()
        .catch((error) => console.error(error))
        .finally(() => {
          busy = false
        })
    }, ms)
    return () => window.clearInterval(timer)
  }, [active, ms, router])
}
