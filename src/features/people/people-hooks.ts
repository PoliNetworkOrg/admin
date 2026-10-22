import { useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useOpenGeneration } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { errorMessage as backendMessage } from "@/lib/errors"

/**
 * After a successful mutation: reload every loader, then confirm. A failed reload is not a failed mutation, so it
 * warns instead of offering to repeat it.
 */
export function useRefreshAfter() {
  const router = useRouter()
  return async (message: string, tone: "success" | "warning" = "success") => {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning(`${message.replace(/\.$/, "")}, but the page couldn't refresh.`)
      return
    }
    appToast[tone](message)
  }
}

/** The message to show for a failed call: the backend's own words, or the fallback (also for a bare UNAUTHORIZED). */
export function errorMessage(cause: unknown, fallback: string) {
  const message = backendMessage(cause, fallback)
  return message === "UNAUTHORIZED" ? fallback : message
}

/**
 * A dialog's open state. Key the dialog with `key`, which changes on every opening, so each one starts clean while the
 * closing animation keeps its content.
 */
export function useDialogState(initiallyOpen = false) {
  const [open, setOpen] = useState(initiallyOpen)
  const key = useOpenGeneration(open)
  return { open, key, onOpenChange: setOpen, show: () => setOpen(true) }
}

/** A dialog opened from a row or a record: `show(target)` remembers what it acts on and opens it. */
export function useDialog<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const state = useDialogState()
  return {
    ...state,
    target,
    show: (next: T) => {
      setTarget(next)
      state.show()
    },
  }
}

/**
 * Loads data for a dialog while it is mounted, again whenever `load` changes (memoize it with its inputs), and not at
 * all while it is `null`. A late answer from an earlier `load` is ignored. While a new `load` runs, `data` is `null`,
 * or the previous answer with `keepPrevious` (search results that stay on screen while the next ones arrive).
 */
export function useLoaded<T>(load: (() => Promise<T>) | null, keepPrevious = false) {
  const [result, setResult] = useState<{ load: (() => Promise<T>) | null; data: T | null; failed: boolean }>({
    load: null,
    data: null,
    failed: false,
  })
  useEffect(() => {
    if (!load) return
    let current = true
    load().then(
      (data) => {
        if (current) setResult({ load, data, failed: false })
      },
      (caught) => {
        console.error(caught)
        if (current) setResult({ load, data: null, failed: true })
      }
    )
    return () => {
      current = false
    }
  }, [load])
  if (load && result.load === load) return { data: result.data, failed: result.failed }
  return { data: keepPrevious ? result.data : null, failed: false }
}
