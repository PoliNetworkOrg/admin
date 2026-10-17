import { useEffect } from "react"

/** `/` focuses the input carrying `data-page-search`: `SearchField` sets it, a page may put it on any search input. */
const PAGE_SEARCH_SELECTOR = "input[data-page-search]"

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']") !== null
  )
}

/** One instance, in the shell: ⌘K / Ctrl+K toggles the palette, `/` focuses the page search. */
export function useKeyboardShortcuts(onTogglePalette: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return

      if (document.querySelector('[role="dialog"]:not([data-command-palette]), [role="alertdialog"]')) return

      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        onTogglePalette()
        return
      }

      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target) || document.querySelector("[data-command-palette]")) return
      const search = document.querySelector<HTMLInputElement>(PAGE_SEARCH_SELECTOR)
      if (!search) return
      event.preventDefault()
      search.focus()
      search.select()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onTogglePalette])
}
