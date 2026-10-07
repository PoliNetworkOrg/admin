import { useCallback, useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

// Shared with ThemeToggle (login, onboarding) and the pre-paint script in __root.tsx.
const STORAGE_KEY = "polinetwork-theme"

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

/**
 * Applies the theme with every transition suppressed: `data-theme-switching` stays on <html> until the
 * frame painted with the new colors is done, so nothing cross-fades (docs/design.md §2.1, §6).
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.setAttribute("data-theme-switching", "")
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")))
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const)
  const toggleTheme = useCallback(() => applyTheme(readTheme() === "dark" ? "light" : "dark"), [])
  return { theme, setTheme: applyTheme, toggleTheme }
}

export function themeToggleLabel(theme: Theme) {
  return theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
}
