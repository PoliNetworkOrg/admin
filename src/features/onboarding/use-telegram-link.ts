import { useRouter } from "@tanstack/react-router"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { z } from "zod"

import { type AdminSession, auth, useSession } from "@/lib/auth"

const storageKey = "linktg"

const savedLinkSchema = z.object({
  username: z.string().min(1),
  code: z.string().min(1),
  ttl: z.number().positive(),
  startTime: z.number().positive(),
})

type SavedLink = z.infer<typeof savedLinkSchema>
type Phase = "idle" | "starting" | "polling" | "expired" | "verified"
type Notice = { kind: "error" | "success"; text: string } | null

export function useTelegramLink(initialSession: AdminSession) {
  const { data: liveSession, refetch: refetchSession } = useSession()
  const router = useRouter()
  const session = liveSession ?? initialSession
  const [username, setUsername] = useState("")
  const [savedLink, setSavedLink] = useState<SavedLink | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [notice, setNotice] = useState<Notice>(null)
  const [now, setNow] = useState(0)
  const [ready, setReady] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const clearSavedLink = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch (error) {
      console.error(error)
      // The in-memory flow can still be reset if storage is unavailable.
    }
    setSavedLink(null)
  }, [])

  const expireLink = useCallback(
    (link: SavedLink) => {
      clearSavedLink()
      setUsername(link.username)
      setPhase("expired")
      setNotice({ kind: "error", text: "This link code expired. Generate a new code to continue." })
    },
    [clearSavedLink]
  )

  const completeLink = useCallback(async () => {
    clearSavedLink()
    setPhase("verified")
    setNotice({ kind: "success", text: "Telegram linked. Opening the dashboard…" })
    await refetchSession()
    await router.invalidate()
    await router.navigate({ to: "/dashboard", replace: true })
  }, [clearSavedLink, refetchSession, router])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const parsed = savedLinkSchema.safeParse(JSON.parse(stored))
        if (parsed.success) {
          const link = parsed.data
          setUsername(link.username)
          if (expiresAt(link) > Date.now()) {
            setSavedLink(link)
            setPhase("polling")
          } else {
            expireLink(link)
          }
        } else {
          window.localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      console.error(error)
      setNotice({ kind: "error", text: "Saved Telegram link state could not be restored. Generate a new code." })
    } finally {
      setNow(Date.now())
      setReady(true)
    }
  }, [expireLink])

  useEffect(() => {
    if (!savedLink) return

    const updateClock = () => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (currentTime >= expiresAt(savedLink)) expireLink(savedLink)
    }

    updateClock()
    const interval = window.setInterval(updateClock, 1_000)
    return () => window.clearInterval(interval)
  }, [expireLink, savedLink])

  useEffect(() => {
    if (!savedLink || phase !== "polling") return

    let stopped = false
    let timeout: number | undefined

    const poll = async () => {
      if (Date.now() >= expiresAt(savedLink)) {
        expireLink(savedLink)
        return
      }

      try {
        const result = await auth.telegram.link.verify({ query: { code: savedLink.code } })
        if (stopped) return
        if (result.error) {
          console.error(result.error)
          setNotice({ kind: "error", text: result.error.message || "Telegram verification could not be checked." })
        } else if (result.data.verified) {
          await completeLink()
          return
        } else if (result.data.expired) {
          expireLink(savedLink)
          return
        } else {
          setNotice(null)
        }
      } catch (error) {
        console.error(error)
        if (!stopped) {
          setNotice({
            kind: "error",
            text: "Telegram verification could not be checked. We will try again automatically.",
          })
        }
      }

      if (!stopped) timeout = window.setTimeout(() => void poll(), 5_000)
    }

    timeout = window.setTimeout(() => void poll(), 5_000)
    return () => {
      stopped = true
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [completeLink, expireLink, phase, savedLink])

  async function startLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const telegramUsername = username.trim().replace(/^@+/, "")
    if (!telegramUsername) return

    setPhase("starting")
    setNotice(null)
    try {
      const result = await auth.telegram.link.start({ telegramUsername })
      if (result.error) {
        console.error(result.error)
        setPhase("idle")
        setNotice({ kind: "error", text: result.error.message || "A Telegram link code could not be created." })
        return
      }

      const link = { username: telegramUsername, code: result.data.code, ttl: result.data.ttl, startTime: Date.now() }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(link))
      } catch (error) {
        console.error(error)
        setNotice({ kind: "error", text: "The code could not be saved in this browser, but it remains usable now." })
      }
      setUsername(telegramUsername)
      setSavedLink(link)
      setNow(Date.now())
      setPhase("polling")
    } catch (error) {
      console.error(error)
      setPhase("idle")
      setNotice({ kind: "error", text: "The authentication service could not create a Telegram link code." })
    }
  }

  async function copyCode() {
    if (!savedLink) return
    try {
      await navigator.clipboard.writeText(savedLink.code)
      setNotice({ kind: "success", text: "Code copied to the clipboard." })
    } catch (error) {
      console.error(error)
      setNotice({ kind: "error", text: "The code could not be copied. Select it and copy it manually." })
    }
  }

  function resetLink() {
    clearSavedLink()
    setPhase("idle")
    setNotice(null)
  }

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    setNotice(null)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      clearSavedLink()
      await refetchSession()
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch (error) {
      console.error(error)
      setNotice({ kind: "error", text: "Could not sign out. Please try again." })
      setLoggingOut(false)
    }
  }

  const remainingSeconds = savedLink ? Math.max(0, Math.ceil((expiresAt(savedLink) - now) / 1_000)) : 0
  const progress = savedLink ? Math.max(0, Math.min(100, (remainingSeconds / savedLink.ttl) * 100)) : 0

  return {
    session,
    username,
    setUsername,
    savedLink,
    phase,
    notice,
    ready,
    loggingOut,
    remainingSeconds,
    progress,
    startLink,
    copyCode,
    resetLink,
    logout,
  }
}

function expiresAt(link: SavedLink) {
  return link.startTime + link.ttl * 1_000
}
