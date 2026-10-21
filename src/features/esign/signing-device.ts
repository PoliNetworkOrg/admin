import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { useSyncExternalStore } from "react"
import { z } from "zod"

import { AGENT_FLAG_KEY } from "./agent.ts"

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

/** "unknown" until the browser can be asked: a Mac's User-Agent may be an iPad's. */
export type SigningDevice = "computer" | "phone" | "unknown"

/**
 * The browser's User-Agent. On the server it comes from the request, so the server render already fits the device and
 * hydration agrees with it.
 */
const userAgent = createIsomorphicFn()
  .server(() => getRequestHeader("user-agent") ?? "")
  .client(() => navigator.userAgent)

const subscribe = () => () => {}

/**
 * Whether this is a computer that can sign or a phone or tablet that can only review. The server render and hydration
 * go by the User-Agent alone, which can't tell an iPad asking for the desktop site from a Mac: there it is "unknown",
 * and the page renders both variants behind the `(hover: none) and (pointer: coarse)` media query, so neither flashes.
 */
export function useSigningDevice(): SigningDevice {
  return useSyncExternalStore(
    subscribe,
    () => (isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints) ? "phone" : "computer"),
    () => {
      const agent = userAgent()
      if (isPhoneOrTablet(agent, 0)) return "phone"
      return /Macintosh/.test(agent) ? "unknown" : "computer"
    }
  )
}

/** False on phones and tablets, where signing buttons give way to a note. */
export function useCanSignHere() {
  return useSigningDevice() !== "phone"
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

const agentFlag = z.object({ version: z.string().nullable(), at: z.string() })
export type AgentFlag = z.infer<typeof agentFlag>

/** What the signing dialog last stored about PoliNetwork eSign in this browser; null when nothing readable is. */
export function readAgentFlag(): AgentFlag | null {
  try {
    const parsed = agentFlag.safeParse(JSON.parse(localStorage.getItem(AGENT_FLAG_KEY) ?? "null"))
    return parsed.success ? parsed.data : null
  } catch (error) {
    console.error(error)
    return null
  }
}

/** Remembers that PoliNetwork eSign answered in this browser; `version` is null for agents that don't announce it. */
export function writeAgentFlag(version: string | null) {
  try {
    localStorage.setItem(AGENT_FLAG_KEY, JSON.stringify({ version, at: new Date().toISOString() }))
  } catch (error) {
    console.error(error)
  }
}

/**
 * Whether PoliNetwork eSign has answered in this browser before, so it needs no setup. True on the server: both
 * answers are one line, so the swap after hydration doesn't move anything.
 */
export function useKnownBrowser() {
  return useSyncExternalStore(
    subscribeStorage,
    () => readAgentFlag() !== null,
    () => true
  )
}
