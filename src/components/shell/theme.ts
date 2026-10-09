import { useCallback, useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

// Shared with ThemeToggle (login, onboarding) and the pre-paint script in __root.tsx.
const STORAGE_KEY = "polinetwork-theme"

function documentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/** The theme the user asked for: where a running reveal is heading, else the document's. */
function readTheme(): Theme {
  return reveal?.heading ?? documentTheme()
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void) {
  listenToDocument()
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  listeners.add(onChange)
  return () => {
    observer.disconnect()
    listeners.delete(onChange)
  }
}

/**
 * Applies the theme with every transition suppressed: `data-theme-switching` stays on <html> until the
 * frame painted with the new colors is done, so nothing cross-fades.
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
 * Light-bulb timing. Turning on is an entrance: light floods out of the toggle fast and settles (ease-out).
 * Turning off is the exit half of that pair: light retreats into the toggle, starting slow and gathering speed
 * (ease-in), ~25% shorter. Full-screen travel earns more than a dialog's 300ms. A reversal replays the elapsed part
 * of the same curve backwards, from wherever the light is.
 */
const LIGHT_ON = { duration: 700, easing: "cubic-bezier(0.32, 0.72, 0, 1)" } as const
const LIGHT_OFF = { duration: 520, easing: "cubic-bezier(0.55, 0.085, 0.68, 0.53)" } as const

/** Upper bound on one reveal, reversals included; the transition ends by itself after it. */
const HOLD_LIMIT = 60_000

/**
 * The reveal in flight. The old snapshot is frozen at `from`; the page underneath (the live new snapshot) already
 * shows `to`. The clip animates the light layer between the two, and `heading` says which end it is going to: each
 * press while it runs reverses the clip from its current radius. When the clip comes to rest the page is set to that
 * end's theme (only needed at `from`, where the live layer is fully hidden, so the switch is invisible) and the hold
 * is released, letting the transition end without a visible change.
 */
type Reveal = {
  from: Theme
  to: Theme
  heading: Theme
  clip: Animation | null
  /** Keeps the transition open between clip runs: it only ends when this is cancelled. */
  hold: Animation | null
}

/**
 * The toggle the light comes from. It gets its own `view-transition-name` so it is drawn live above both snapshots:
 * its icon follows every press and it shows hover, instead of sitting frozen inside the old snapshot.
 */
const TOGGLE_NAME = "pn-theme-toggle"
let liveToggle: HTMLElement | null = null

let reveal: Reveal | null = null

function iconCenter(element: Element | null): Point | null {
  const icon = element?.querySelector("svg") ?? element
  const box = icon?.getBoundingClientRect()
  if (!box || (box.width === 0 && box.height === 0)) return null
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** The pressed toggle; without one (command palette) the first visible `data-theme-toggle`. */
function revealToggle(source?: ThemeToggleSource): HTMLElement | null {
  if (source?.currentTarget instanceof HTMLElement) return source.currentTarget
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-theme-toggle]")).find((toggle) => iconCenter(toggle)) ??
    null
  )
}

function toggleAt(x: number, y: number) {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-theme-toggle]")).find((element) => {
    const box = element.getBoundingClientRect()
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  })
}

let pointer: Point | null = null

/**
 * Chrome hit-tests every pointer event to <html> during a view transition, so `:hover` never reaches the toggle.
 * While one is on screen the toggle under the pointer gets `data-pointer-over` (styled like hover in styles.css)
 * and the pointer cursor. The position is tracked all the time, so a pointer resting on the toggle is marked as
 * soon as a reveal starts.
 */
function markPointerOver() {
  const over = liveToggle && pointer ? toggleAt(pointer.x, pointer.y) : undefined
  for (const toggle of document.querySelectorAll("[data-pointer-over]")) {
    if (toggle !== over) toggle.removeAttribute("data-pointer-over")
  }
  over?.setAttribute("data-pointer-over", "")
  document.documentElement.style.cursor = over ? "pointer" : ""
}

function onPointerMove(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY }
  if (liveToggle) markPointerOver()
}

/**
 * Presses also land on <html> during a transition. While one is on screen (including the frame or two between a
 * reveal settling and its snapshots going), a press whose point falls on a `data-theme-toggle` is treated as
 * pressing it: it reverses the running reveal, or starts the next one if it has just settled.
 */
function onRevealPress(event: MouseEvent) {
  // A click goes to the common ancestor of where the button went down and came up: if a transition starts or ends
  // between the two, it lands on <html> even with no transition left, so this listens all the time.
  if (event.target !== document.documentElement) return
  const toggle = toggleAt(event.clientX, event.clientY)
  if (!toggle) return
  pointer = { x: event.clientX, y: event.clientY }
  event.preventDefault()
  switchTheme(readTheme() === "dark" ? "light" : "dark", { currentTarget: toggle })
}

let listening = false

/** Installed once, by the first `useTheme`: the press fallback and the pointer position (see above). */
function listenToDocument() {
  if (listening) return
  listening = true
  document.addEventListener("click", onRevealPress, true)
  document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true })
}

/** Ends what a transition set up, once no newer reveal owns it. */
function teardown() {
  document.documentElement.style.cursor = ""
  for (const toggle of document.querySelectorAll("[data-pointer-over]")) toggle.removeAttribute("data-pointer-over")
  if (liveToggle) liveToggle.style.viewTransitionName = ""
  liveToggle = null
  document.documentElement.removeAttribute("data-theme-switching")
  document.documentElement.removeAttribute("data-theme-reveal")
}

/** The clip reached an end: settle the page on that end's theme and let the transition finish. */
function settle(current: Reveal) {
  if (reveal !== current) return
  if (current.heading !== current.to) commitTheme(current.from)
  reveal = null
  current.hold?.cancel()
  notify()
}

/**
 * Switches the theme like a light bulb at the toggle's icon: to light, the new (light) snapshot grows as a circle
 * from the icon to the farthest corner; to dark, the old (light) snapshot shrinks from the corners back into the
 * icon, uncovering the dark one beneath (`data-theme-reveal="off"` stacks it on top). Pressing again mid-way sends
 * the light back the other way from where it is. Falls back to the instant swap without View Transitions or with
 * reduced motion.
 */
function switchTheme(theme: Theme, source?: ThemeToggleSource) {
  if (reveal) {
    if (theme === reveal.heading) return
    reveal.heading = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
    reveal.clip?.reverse()
    notify()
    return
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!("startViewTransition" in document) || reduceMotion) {
    applyTheme(theme)
    return
  }

  const root = document.documentElement
  const from = documentTheme()
  const current: Reveal = { from, to: theme, heading: theme, clip: null, hold: null }
  reveal = current
  const toggle = revealToggle(source)
  const { x, y } = iconCenter(toggle) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const lightOn = theme === "light"
  const bulb = (r: number) => `circle(${r}px at ${x}px ${y}px)`
  // The new snapshot is live: keep CSS transitions off until the reveal ends, or colors would also fade.
  root.setAttribute("data-theme-switching", "")
  root.setAttribute("data-theme-reveal", lightOn ? "on" : "off")
  if (liveToggle && liveToggle !== toggle) liveToggle.style.viewTransitionName = ""
  liveToggle = toggle
  if (toggle) toggle.style.viewTransitionName = TOGGLE_NAME
  markPointerOver()
  notify()

  const transition = document.startViewTransition(() => commitTheme(theme))
  transition.ready
    .then(() => {
      current.hold = root.animate({ opacity: [1, 1] }, { duration: HOLD_LIMIT, pseudoElement: "::view-transition" })
      current.clip = root.animate(
        { clipPath: lightOn ? [bulb(0), bulb(radius)] : [bulb(radius), bulb(0)] },
        {
          ...(lightOn ? LIGHT_ON : LIGHT_OFF),
          pseudoElement: lightOn ? "::view-transition-new(root)" : "::view-transition-old(root)",
          // Hold whichever end it stops at until the snapshots go: dropping the clip a frame early flashed the
          // other theme across the screen.
          fill: "both",
        }
      )
      current.clip.addEventListener("finish", () => settle(current))
      // Pressed again before the clip existed: run it backwards from the start, i.e. settle back at `from`.
      if (current.heading !== current.to) current.clip.reverse()
    })
    .catch((error) => console.error(error))
  transition.finished
    .catch((error) => console.error(error))
    .finally(() => {
      // Skipped or timed out before the clip settled: settle without animation.
      settle(current)
      current.clip?.cancel()
      current.hold?.cancel()
      // A newer reveal may already own these (a press landed while this one's snapshots were going).
      if (!reveal) teardown()
    })
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const)
  /** Pass the click event so the reveal starts from the pressed toggle's icon. */
  const toggleTheme = useCallback(
    (source?: ThemeToggleSource) => switchTheme(readTheme() === "dark" ? "light" : "dark", source),
    []
  )
  return { theme, toggleTheme }
}

export function themeToggleLabel(theme: Theme) {
  return theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
}
