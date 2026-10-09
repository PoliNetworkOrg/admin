import { useLayoutEffect, useRef } from "react"

const FOCUSABLE = "button, a[href], input, [tabindex]"

/** Tab-reachable controls of a row, in DOM order. */
function actionsOf(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.tabIndex >= 0 && !element.matches(":disabled")
  )
}

type Captured = { element: HTMLElement; row: number; action: number; restore: boolean }

/**
 * Keeps focus in a list when the row holding it unmounts (optimistic removal, confirmed delete). Rows are
 * the `rowSelector` matches inside `surfaceRef`; give the surface `tabIndex={-1}` so it can be the fallback.
 *
 * - `capture(element, { restore: true })` before an optimistic removal: once the row is gone, focus moves on
 *   its own.
 * - `capture(element)` when a confirm dialog removes the row, and pass `target` to `ConfirmDialog.finalFocus`.
 */
export function useFocusAfterRemoval<T extends HTMLElement>(rowSelector: string) {
  const surfaceRef = useRef<T>(null)
  const captured = useRef<Captured | null>(null)

  function rows() {
    return Array.from(surfaceRef.current?.querySelectorAll<HTMLElement>(rowSelector) ?? [])
  }

  function capture(element: HTMLElement, { restore = false }: { restore?: boolean } = {}) {
    const row = element.closest<HTMLElement>(rowSelector)
    if (!row) return
    const action = actionsOf(row).indexOf(element)
    captured.current = { element, row: rows().indexOf(row), action, restore }
  }

  /** The element itself while mounted; else the same action in the row now at its position (or the row above); else the surface. */
  function target(): HTMLElement | null {
    const memo = captured.current
    if (!memo) return null
    if (memo.element.isConnected) return memo.element
    const list = rows()
    const row = list[memo.row] ?? list[memo.row - 1]
    const actions = row ? actionsOf(row) : []
    return actions[memo.action] ?? actions[0] ?? surfaceRef.current
  }

  useLayoutEffect(() => {
    const memo = captured.current
    if (!memo?.restore || memo.element.isConnected) return
    // Only when the removal dropped focus to the body; never steal it from where the user moved on to.
    const lost = document.activeElement === null || document.activeElement === document.body
    if (lost) target()?.focus()
    captured.current = null
  })

  return { surfaceRef, capture, target }
}
