import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
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

/**
 * The browser's user agent. On the server it comes from the request, so the server render already fits the device
 * and hydration agrees with it; only an iPad, which needs the touch screen to tell, changes after hydration.
 */
const userAgent = createIsomorphicFn()
  .server(() => getRequestHeader("user-agent") ?? "")
  .client(() => navigator.userAgent)

const subscribe = () => () => {}

/** False on phones and tablets, where signing buttons give way to a note. */
export function useCanSignHere() {
  return useSyncExternalStore(
    subscribe,
    () => !isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints),
    () => !isPhoneOrTablet(userAgent(), 0)
  )
}

function computerOs(agent: string, maxTouchPoints: number) {
  return isPhoneOrTablet(agent, maxTouchPoints) ? null : detectOs(agent)
}

/** This computer's system, for setup steps and downloads; `null` on phones and tablets. */
export function useComputerOs() {
  return useSyncExternalStore(
    subscribe,
    () => computerOs(navigator.userAgent, navigator.maxTouchPoints),
    () => computerOs(userAgent(), 0)
  )
}
