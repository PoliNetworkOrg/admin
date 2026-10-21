import { useSyncExternalStore } from "react"

/**
 * PoliNetwork eSign runs only on macOS, Windows and Linux computers: phones and tablets can review a document but not
 * sign it. iPadOS Safari reports itself as a Mac, so it is told apart by its touch screen.
 */
export function isPhoneOrTablet(userAgent: string, maxTouchPoints: number) {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export type Os = "macos" | "windows" | "linux"

/** The computer's system, for downloads and setup steps. Phones and tablets get macOS: check isPhoneOrTablet first. */
export function detectOs(userAgent: string): Os {
  if (/windows/i.test(userAgent)) return "windows"
  if (/linux|x11/i.test(userAgent) && !/android/i.test(userAgent)) return "linux"
  return "macos"
}

const subscribe = () => () => {}

/** False on phones and tablets, where signing buttons give way to a note. True while rendering on the server. */
export function useCanSignHere() {
  return useSyncExternalStore(
    subscribe,
    () => !isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints),
    () => true
  )
}
