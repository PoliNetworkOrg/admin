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
  commitTheme(theme)
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")))
}

function commitTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

type Point = { x: number; y: number }

/** What a toggle's click handler receives (a React mouse event); its `currentTarget` is the pressed toggle. */
export type ThemeToggleSource = { currentTarget: EventTarget | null }

/**
 * Light-bulb timing (§6). Turning on is an entrance: light floods out of the toggle fast and settles (ease-out).
 * Turning off is the exit half of that pair: light retreats into the toggle, starting slow and gathering speed
 * (ease-in), ~25% shorter. Full-screen travel earns more than a dialog's 300ms.
 */
const LIGHT_ON = { duration: 700, easing: "cubic-bezier(0.32, 0.72, 0, 1)" } as const
const LIGHT_OFF = { duration: 520, easing: "cubic-bezier(0.55, 0.085, 0.68, 0.53)" } as const

function iconCenter(element: Element | null): Point | null {
  const icon = element?.querySelector("svg") ?? element
  const box = icon?.getBoundingClientRect()
  if (!box || (box.width === 0 && box.height === 0)) return null
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** The pressed toggle's icon; without one (command palette) the visible `data-theme-toggle`, else the center. */
function revealOrigin(source?: ThemeToggleSource): Point {
  const pressed = source?.currentTarget instanceof Element ? source.currentTarget : null
  const marked = Array.from(document.querySelectorAll("[data-theme-toggle]")).map(iconCenter).find(Boolean)
  return iconCenter(pressed) ?? marked ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

/**
 * Switches the theme like a light bulb at the toggle's icon: to light, the new (light) snapshot grows as a circle
 * from the icon to the farthest corner; to dark, the old (light) snapshot shrinks from the corners back into the
 * icon, uncovering the dark one beneath (`data-theme-reveal="off"` stacks it on top). Falls back to the instant
 * swap without View Transitions or with reduced motion.
 */
function switchTheme(theme: Theme, source?: ThemeToggleSource) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!("startViewTransition" in document) || reduceMotion) {
    applyTheme(theme)
    return
  }

  const root = document.documentElement
  const { x, y } = revealOrigin(source)
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const lightOn = theme === "light"
  const bulb = (r: number) => `circle(${r}px at ${x}px ${y}px)`
  // The new snapshot is live: keep CSS transitions off until the reveal ends, or colors would also fade.
  root.setAttribute("data-theme-switching", "")
  root.setAttribute("data-theme-reveal", lightOn ? "on" : "off")
  const transition = document.startViewTransition(() => commitTheme(theme))
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: lightOn ? [bulb(0), bulb(radius)] : [bulb(radius), bulb(0)] },
        {
          ...(lightOn ? LIGHT_ON : LIGHT_OFF),
          pseudoElement: lightOn ? "::view-transition-new(root)" : "::view-transition-old(root)",
          // Hold the end state until the snapshots are removed: without it the clip is dropped for one frame first,
          // and the old light snapshot, stacked on top while turning off, flashed across the whole screen.
          fill: "forwards",
        }
      )
    })
    .catch((error) => console.error(error))
  transition.finished
    .catch((error) => console.error(error))
    .finally(() => {
      root.removeAttribute("data-theme-switching")
      root.removeAttribute("data-theme-reveal")
    })
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const)
  /** Pass the click event so the reveal starts from the pressed toggle's icon. */
  const toggleTheme = useCallback(
    (source?: ThemeToggleSource) => switchTheme(readTheme() === "dark" ? "light" : "dark", source),
    []
  )
  return { theme, setTheme: applyTheme, toggleTheme }
}

export function themeToggleLabel(theme: Theme) {
  return theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
}
