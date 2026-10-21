import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Ban,
  Circle,
  CircleAlert,
  CircleCheck,
  Download,
  KeyRound,
  LoaderCircle,
  MonitorDown,
  PenLine,
  Play,
  TriangleAlert,
  X,
} from "lucide-react"
import { type ReactElement, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"
import { z } from "zod"

import { buttonMotion, dialogMotion, InlineAlert, LoadingButton, scrimClasses } from "@/components/primitives"
import {
  dialogDescriptionText,
  dialogFooter,
  dialogFooterButton,
  dialogPanel,
  dialogTitleText,
} from "@/components/primitives/confirm-dialog"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { AGENT_LAUNCH_URL, agentSignUrl, isAgentOrigin } from "./agent"
import { cancelEsignSignature, getEsignJobStatus, startEsignSignature } from "./esign.functions"
import type { BoxPlacement } from "./signature-box"
import { detectOs, readAgentFlag, writeAgentFlag } from "./signing-device"
import {
  agentDownload,
  closedWindowAction,
  deadlineFor,
  type Ending,
  type FatalState,
  type Job,
  type JobState,
  type JobStatus,
  jobFailure,
  notRunningVariant,
  OPEN_STATUSES,
  OUTDATED,
  outcomeOf,
  stateForFatal,
} from "./signing-state"

/** A document to sign; `places` are the signer's boxes as they dragged them, one per place, in order. */
export type SignItem = { requestId: string; title: string; places?: BoxPlacement[] }

type Session = { jobs: Job[]; url: string }

type Mode =
  /** Waiting for PoliNetwork eSign to answer; `deadline` is null while the jobs are still being created. */
  | { kind: "opening"; deadline: number | null }
  | { kind: "blocked" }
  | { kind: "signing" }
  | { kind: "notRunning"; variant: "start" | "install"; setupOpened: boolean }
  | { kind: "starting" }
  | { kind: "stopped" }
  | { kind: "fatal"; state: FatalState; message: string }
  | { kind: "ended"; ending: Ending }
  | { kind: "signed" }
  | { kind: "partial" }

/** States after which nothing is followed anymore: the dialog waits for Close, or closes by itself. */
const SETTLED = new Set<Mode["kind"]>(["ended", "signed", "partial"])

const POLL_MS = 1200
/** The agent window must read closed on this many polls in a row before the dialog acts on it… */
const CLOSED_READS = 2
/** …the next of which comes this soon after the first. */
const CLOSED_RECHECK_MS = 400
/** The agent's "Signed" stays up at least this long before the dashboard closes its window. */
const SIGNED_MIN_MS = 1000
/** The agent closes its own window this long after success: the hand-off never waits longer. */
const SIGNED_MAX_MS = 4000
/** Start: without a prompt taking the focus, the window opens again after this long; with one, when it's answered. */
const PROMPT_MS = 1200
const PROMPT_MAX_MS = 8000
/** Start: time for PoliNetwork eSign to come up before its page is loaded, then how long each load may take. */
const LAUNCH_MS = 800
const START_WAIT_MS = 3000

/** What PoliNetwork eSign's page posts to its opener (docs/esign/contracts.md); up to v0.1.x as "pn-sign-agent". */
const agentMessage = z.object({
  type: z.enum(["pn-esign", "pn-sign-agent"]),
  status: z.string(),
  detail: z.string().max(64).optional(),
  message: z.string().max(1000).optional(),
  fatal: z.boolean().optional(),
})
type AgentMessage = z.infer<typeof agentMessage>

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** The agent window's size, centered horizontally over the dashboard window. */
function popupFeatures() {
  const width = 460
  const height = 680
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 3)
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`
}

/** A blank window saying `text`, until it is sent to the agent's page. */
function openPopup(text: string): Window | null {
  // A new name each time: a window still showing the agent's page is cross-origin, and writing to it would throw.
  const popup = window.open("", `pn-esign-${Date.now()}`, popupFeatures())
  if (popup) {
    popup.document.title = "PoliNetwork eSign"
    // The agent page's canvas and muted text (sign-agent internal/server/web/assets/style.css), following the OS
    // scheme as that page does rather than the dashboard's theme, so the page takes over without a change of colour.
    popup.document.documentElement.style.colorScheme = "light dark"
    popup.document.body.style.cssText =
      "font:15px system-ui,sans-serif;background:#f6f7f9;background:light-dark(#f6f7f9,#060e16);color:#58626c;color:light-dark(#58626c,#9da6ae);display:grid;place-items:center;height:90vh;margin:0"
    popup.document.body.textContent = text
  }
  return popup
}

/** Resolves once the browser's "Open PoliNetwork eSign?" prompt has been answered, or plainly didn't show. */
function promptAnswered() {
  return new Promise<void>((resolve) => {
    let blurred = false
    const quiet = window.setTimeout(() => !blurred && done(), PROMPT_MS)
    const cap = window.setTimeout(done, PROMPT_MAX_MS)
    const onBlur = () => {
      blurred = true
    }
    const onFocus = () => blurred && done()
    function done() {
      window.clearTimeout(quiet)
      window.clearTimeout(cap)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      resolve()
    }
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
  })
}

type SignOptions = (
  | { items: SignItem[]; prepare?: never }
  | {
      items?: never
      /**
       * Decides in the click what to sign, for documents that don't exist yet: null leaves the popup closed (the caller
       * shows why), else the popup opens and the promise's documents are signed (none: it closes again).
       */
      prepare: () => Promise<SignItem[]> | null
    }
) & {
  /**
   * Called once every document is signed, with the agent's "Signed" on screen: the page updates behind the dialog
   * meanwhile (at least 1 s, at most 4 s), then the agent window and the dialog close. Without it the dialog reloads
   * the page's data and toasts the outcome.
   */
  handOff?: (requestIds: string[]) => Promise<void>
  /** After the signatures are saved: when the dialog starts closing after a hand-off, else once the data reloaded. */
  onSigned?: () => void
  /** After the dialog closes before every document is signed, or the signature couldn't start (with why). */
  onStopped?: (error: string | null) => void
  /** Where focus goes after a hand-off or an ended attempt, whose trigger is usually gone; otherwise the trigger. */
  finalFocus?: () => HTMLElement | null
}

/**
 * Signs one or more documents with PoliNetwork eSign: `start` (called in a click) opens the agent's page in a popup,
 * where one PIN signs them all, and `dialog` follows the jobs until every signature is saved. The dashboard never
 * talks to the agent: browsers block HTTPS pages from fetching loopback addresses, but they allow opening a window
 * there. Render `dialog` where it outlives the trigger, which the page may replace while the signatures land.
 */
export function useSignWithCie(options: SignOptions) {
  const { items, prepare, handOff, onSigned, onStopped, finalFocus } = options
  const router = useRouter()
  const startFn = useServerFn(startEsignSignature)
  const cancelFn = useServerFn(cancelEsignSignature)
  const statusFn = useServerFn(getEsignJobStatus)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [states, setStates] = useState<Map<string, JobState>>(new Map())
  // An ended attempt's Close is reloading the page before the dialog closes; stays set while it fades out.
  const [closing, setClosing] = useState(false)
  const popupRef = useRef<Window | null>(null)
  // Handlers outside React's render (timers, messages, polls) read the current state from these.
  const sessionRef = useRef<Session | null>(null)
  const modeRef = useRef<Mode | null>(null)
  const statesRef = useRef<Map<string, JobState>>(new Map())
  const finishing = useRef(false)
  /** PoliNetwork eSign answered the window's current page: with `ready`, an error, or by fetching a job. */
  const answered = useRef(false)
  /** Whether a job being fetched counts as an answer: not when it was already fetched before this load. */
  const seenCounts = useRef(true)
  /** A fatal error waiting for the next poll, which may show that the job ended by itself. */
  const fatal = useRef<{ message: string; at: number } | null>(null)
  /** The agent window explained an error itself, so it stays open. */
  const fatalShown = useRef(false)
  const startFailed = useRef(false)
  const closedReads = useRef(0)
  /** Bumped by every start and close, so a Start still waiting on the browser stops. */
  const attempt = useRef(0)
  const focusAfter = useRef<(() => HTMLElement | null) | null>(null)
  /**
   * Where focus returns otherwise. Set explicitly: the trigger is disabled while the jobs are created, which drops its
   * focus before the dialog opens.
   */
  const triggerRef = useRef<HTMLButtonElement>(null)
  const preparing = prepare !== undefined

  function show(next: Session | null) {
    sessionRef.current = next
    setSession(next)
  }

  function go(next: Mode) {
    modeRef.current = next
    setMode(next)
  }

  async function reload() {
    try {
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
    }
  }

  /** Every document is signed and nothing hands off: reloads the page's data, then closes and says so. */
  async function finish(count: number) {
    if (finishing.current) return
    finishing.current = true
    await reload()
    show(null)
    popupRef.current = null
    appToast.success(count === 1 ? "Document signed." : `${count} documents signed.`)
    onSigned?.()
  }

  /**
   * Every document is signed: the page behind updates while the agent says "Signed", then its window and the dialog
   * close together, at least 1 s and at most 4 s after the signatures were saved.
   */
  async function handOver(jobs: Job[], update: (requestIds: string[]) => Promise<void>) {
    if (finishing.current) return
    finishing.current = true
    const updated = update(jobs.map((j) => j.requestId)).catch((cause) => console.error(cause))
    await Promise.race([Promise.all([updated, sleep(SIGNED_MIN_MS)]), sleep(SIGNED_MAX_MS)])
    popupRef.current?.close()
    popupRef.current = null
    focusAfter.current = finalFocus ?? null
    show(null)
    onSigned?.()
  }

  /** Closes the dialog after the signer's own cancel: no message, no reload, nothing left to cancel. */
  function dismiss() {
    if (finishing.current) return
    finishing.current = true
    show(null)
    popupRef.current?.close()
    popupRef.current = null
    onStopped?.(null)
  }

  /**
   * Remembers that PoliNetwork eSign answered in this browser, and stops waiting for it. A job fetch answers only while
   * waiting, so it never overwrites the version a `ready` just stored.
   */
  function answer(version: string | null) {
    writeAgentFlag(version)
    answered.current = true
    const kind = modeRef.current?.kind
    if (kind === "opening" || kind === "starting") go({ kind: "signing" })
  }

  /** Sends the agent window to the signing page, waiting for PoliNetwork eSign to answer it. */
  function load(popup: Window, url: string, next: "opening" | "starting") {
    popup.location.href = url
    answered.current = false
    closedReads.current = 0
    fatal.current = null
    const flag = readAgentFlag()
    // A job fetched before this load says nothing about the agent now, except for agents that never say "ready".
    seenCounts.current = flag?.version === null || ![...statesRef.current.values()].some((s) => s.seen)
    if (next === "opening") go({ kind: "opening", deadline: Date.now() + deadlineFor(flag) })
  }

  function notRunning() {
    // The attempt is over (Cancel while waiting for the agent): the dialog keeps its last state while it fades out.
    if (finishing.current || !sessionRef.current) return
    popupRef.current?.close()
    popupRef.current = null
    go({ kind: "notRunning", variant: notRunningVariant(readAgentFlag(), startFailed.current), setupOpened: false })
  }

  /** The ready deadline passed: one more look at the jobs, then the agent counts as not running. */
  async function deadlinePassed() {
    const waiting = modeRef.current
    const current = sessionRef.current
    if (current) await poll(current)
    if (modeRef.current === waiting) notRunning()
  }

  async function poll(current: Session) {
    const startedAt = Date.now()
    // Readable only while the dashboard keeps its opener relationship with the window: the agent sends no COOP
    // header, and the dashboard must not send `Cross-Origin-Opener-Policy: same-origin`.
    const closedBefore = popupRef.current?.closed !== false
    try {
      const statuses = await statusFn({ data: { jobIds: current.jobs.map((j) => j.jobId) } })
      if (sessionRef.current !== current) return
      track(statuses, closedBefore && popupRef.current?.closed !== false, startedAt)
    } catch (cause) {
      console.error(cause)
    }
  }

  function track(statuses: JobStatus[], closed: boolean, startedAt: number) {
    const current = sessionRef.current
    const now = modeRef.current
    if (!current || !now || finishing.current || SETTLED.has(now.kind)) return
    statesRef.current = new Map(statuses.map((s) => [s.jobId, s]))
    setStates(statesRef.current)
    const outcome = outcomeOf(statuses, current.jobs, preparing)
    switch (outcome.kind) {
      case "signed":
        go({ kind: "signed" })
        return void (handOff ? handOver(current.jobs, handOff) : finish(current.jobs.length))
      case "partial":
        return go({ kind: "partial" })
      case "dismissed":
        return dismiss()
      case "ended": {
        const { reason } = outcome.ending
        // Someone else ended the request: the agent window would keep asking for a PIN that can sign nothing. An
        // agent too old to explain itself shows only plain text.
        if (reason === "cancelled" || reason === "declined" || (reason === "outdated" && !fatalShown.current))
          popupRef.current?.close()
        return go({ kind: "ended", ending: outcome.ending })
      }
    }
    if ((now.kind === "opening" || now.kind === "starting") && seenCounts.current && statuses.some((s) => s.seen))
      answer(null)
    if (fatal.current && fatal.current.at <= startedAt) {
      go({ kind: "fatal", state: "continue", message: fatal.current.message })
      fatal.current = null
      return
    }
    if (modeRef.current?.kind !== "signing") return
    closedReads.current = closed ? closedReads.current + 1 : 0
    if (closedReads.current === 1) void sleep(CLOSED_RECHECK_MS).then(() => poll(current))
    if (closedReads.current < CLOSED_READS) return
    const action = closedWindowAction(answered.current, statuses)
    if (action === "partial") go({ kind: "partial" })
    else if (action === "dismiss") void close()
  }

  function onMessage(data: AgentMessage) {
    if (!modeRef.current || finishing.current) return
    if (data.status === "ready") return answer(data.detail || "unknown")
    if (data.status !== "error") return
    if (data.fatal) {
      answered.current = true
      fatalShown.current = true
      const state = stateForFatal(data.detail ?? "")
      const message = data.message || "Nothing was signed."
      // Other errors wait for the poll this message starts: the job may have ended with words of its own.
      if (state === "continue") fatal.current = { message, at: Date.now() }
      else go({ kind: "fatal", state, message })
      return
    }
    // The page lost the agent behind it: the one outcome the backend can't know about.
    if (data.detail === "agent_unreachable" && answered.current) go({ kind: "stopped" })
  }

  async function start() {
    if (creating || (finishing.current && sessionRef.current)) return
    const prepared = prepare ? prepare() : Promise.resolve(items ?? [])
    if (!prepared) return
    const mine = ++attempt.current
    finishing.current = false
    fatal.current = null
    fatalShown.current = false
    startFailed.current = false
    focusAfter.current = null
    statesRef.current = new Map()
    setStates(statesRef.current)
    setError(null)
    setClosing(false)
    popupRef.current?.close()
    // Opened synchronously in the click, so the browser doesn't block it.
    const popup = openPopup("Opening PoliNetwork eSign…")
    popupRef.current = popup
    // Sign again, from the dialog: it stays open, and the old jobs are no longer followed.
    if (sessionRef.current) {
      sessionRef.current = null
      go({ kind: "opening", deadline: null })
    }
    setCreating(true)
    try {
      const toSign = await prepared
      if (toSign.length === 0) {
        popup?.close()
        show(null)
        return
      }
      const started = await startFn({
        data: { items: toSign.map((item) => ({ requestId: item.requestId, places: item.places })) },
      })
      // Cancelled while the jobs were created (Sign again keeps the dialog open meanwhile).
      if (mine !== attempt.current) {
        popup?.close()
        await cancelFn({ data: { jobIds: started.map((s) => s.jobId) } })
        return
      }
      const url = agentSignUrl(
        started.map((s) => s.ticket),
        window.location.origin
      )
      const titles = new Map(toSign.map((item) => [item.requestId, item.title]))
      show({
        jobs: started.map((s) => ({ jobId: s.jobId, requestId: s.requestId, title: titles.get(s.requestId) ?? "" })),
        url,
      })
      if (!popup) go({ kind: "blocked" })
      else if (popup.closed) notRunning()
      else load(popup, url, "opening")
    } catch (cause) {
      console.error(cause)
      popup?.close()
      show(null)
      const message = cause instanceof Error ? cause.message : "Couldn't start the signature."
      setError(message)
      onStopped?.(message)
    } finally {
      setCreating(false)
    }
  }

  /** Closes the dialog, cancelling what isn't signed yet; reloads when something was signed or the attempt ended. */
  async function close() {
    if (finishing.current) return
    finishing.current = true
    attempt.current++
    const current = sessionRef.current
    const now = modeRef.current
    const ended =
      now?.kind === "ended" ||
      now?.kind === "partial" ||
      (now?.kind === "fatal" && (now.state === "expired" || now.state === "outdated"))
    popupRef.current?.close()
    popupRef.current = null
    const status = (job: Job) => statesRef.current.get(job.jobId)?.status ?? "pending"
    const open = current?.jobs.filter((j) => OPEN_STATUSES.has(status(j))) ?? []
    const signed = current?.jobs.some((j) => status(j) === "completed") ?? false
    if (ended) {
      // Reloaded while the dialog is still open, as a hand-off does: the request may have changed meanwhile.
      setClosing(true)
      focusAfter.current = finalFocus ?? null
    } else show(null)
    if (open.length > 0) {
      try {
        await cancelFn({ data: { jobIds: open.map((j) => j.jobId) } })
      } catch (cause) {
        console.error(cause)
      }
    }
    if (ended || signed) await reload()
    show(null)
    onStopped?.(null)
  }

  /** Brings the agent window to the front without reloading it (the PIN may be half typed), or opens it again. */
  function showWindow(url: string) {
    const popup = popupRef.current
    if (popup && !popup.closed) popup.focus()
    else popupRef.current = window.open(url, `pn-esign-${Date.now()}`, popupFeatures())
    closedReads.current = 0
  }

  /** Loads the signing page again with the same links, opening the agent window if it was closed. */
  function retry() {
    const current = sessionRef.current
    if (!current) return
    const popup =
      popupRef.current && !popupRef.current.closed ? popupRef.current : openPopup("Opening PoliNetwork eSign…")
    popupRef.current = popup
    if (!popup) return go({ kind: "blocked" })
    load(popup, current.url, "opening")
    popup.focus()
  }

  /**
   * "Start PoliNetwork eSign" is a link to the agent's own scheme: the browser asks whether to open it, and no window
   * may cover that question. Once it's answered the signing window opens again, and the page loads twice at most.
   */
  async function startAgent() {
    const current = sessionRef.current
    if (!current) return
    const mine = ++attempt.current
    const starting = () => mine === attempt.current && modeRef.current?.kind === "starting"
    go({ kind: "starting" })
    await promptAnswered()
    if (!starting()) return
    const open = popupRef.current && !popupRef.current.closed
    const popup = open ? popupRef.current : openPopup("Starting PoliNetwork eSign…")
    popupRef.current = popup
    if (!popup) return go({ kind: "blocked" })
    await sleep(LAUNCH_MS)
    for (let tries = 0; tries < 2; tries++) {
      if (!starting()) return
      if (popup.closed) return notRunning()
      load(popup, current.url, "starting")
      popup.focus()
      await sleep(START_WAIT_MS)
    }
    if (!starting()) return
    startFailed.current = true
    notRunning()
  }

  // The latest handlers, for the timers and listeners below, which outlive a render.
  const latest = useRef({ poll, onMessage, deadlinePassed, notRunning })
  useLayoutEffect(() => {
    latest.current = { poll, onMessage, deadlinePassed, notRunning }
  })

  const following =
    session !== null && mode !== null && !SETTLED.has(mode.kind) && !(mode.kind === "opening" && !mode.deadline)
  useEffect(() => {
    if (!following || !session) return
    const run = () => void latest.current.poll(session)
    const timer = window.setInterval(run, POLL_MS)
    function listen(event: MessageEvent) {
      if (!isAgentOrigin(event.origin)) return
      const message = agentMessage.safeParse(event.data)
      if (!message.success) return
      latest.current.onMessage(message.data)
      run()
    }
    window.addEventListener("message", listen)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("message", listen)
    }
  }, [following, session])

  const deadline = session && mode?.kind === "opening" ? mode.deadline : null
  useEffect(() => {
    if (deadline === null) return
    // Closed before PoliNetwork eSign answered: most likely on the browser's "can't be reached" page.
    const watch = window.setInterval(() => {
      if (popupRef.current?.closed !== false) latest.current.notRunning()
    }, 250)
    const timer = window.setTimeout(() => void latest.current.deadlinePassed(), Math.max(0, deadline - Date.now()))
    return () => {
      window.clearInterval(watch)
      window.clearTimeout(timer)
    }
  }, [deadline])

  const dialog = (
    <SigningDialog
      open={session !== null}
      mode={mode}
      jobs={session?.jobs ?? []}
      states={states}
      preparing={preparing}
      closing={closing}
      onClose={() => void close()}
      onSignAgain={() => void start()}
      onShowWindow={() => session && showWindow(session.url)}
      onRetry={retry}
      onStartAgent={() => void startAgent()}
      onSetupOpened={() => {
        const now = modeRef.current
        if (now?.kind === "notRunning") go({ ...now, setupOpened: true })
      }}
      finalFocus={() => focusAfter.current?.() ?? (triggerRef.current?.isConnected ? triggerRef.current : null)}
    />
  )

  return { start: () => void start(), creating, error, dialog, triggerRef }
}

/**
 * "Sign with CIE": the trigger, its start error and the signing dialog together, for pages where the trigger stays
 * while the signatures land.
 */
export function SignWithCie({
  disabled,
  children,
  className,
  describedBy,
  ...options
}: SignOptions & {
  disabled?: boolean
  children?: ReactNode
  /** For the trigger, e.g. `w-full` in a card. */
  className?: string
  /** The id of the text explaining why the trigger is disabled. */
  describedBy?: string
}) {
  const signing = useSignWithCie(options)
  const count = options.items?.length
  return (
    <>
      <SignTrigger signing={signing} disabled={disabled || count === 0} className={className} describedBy={describedBy}>
        {children ?? (count && count > 1 ? `Sign ${count} documents` : "Sign with CIE")}
      </SignTrigger>
      {signing.dialog}
    </>
  )
}

/** The button that starts a signature, with why it couldn't start under it. */
export function SignTrigger({
  signing,
  disabled,
  className,
  describedBy,
  children = "Sign with CIE",
}: {
  signing: ReturnType<typeof useSignWithCie>
  disabled?: boolean
  className?: string
  describedBy?: string
  children?: ReactNode
}) {
  return (
    <>
      <LoadingButton
        ref={signing.triggerRef}
        icon={PenLine}
        pending={signing.creating}
        disabled={disabled}
        onClick={signing.start}
        aria-describedby={describedBy}
        className={cn("h-10", className)}
      >
        {children}
      </LoadingButton>
      {signing.error && <InlineAlert className="mt-2">{signing.error}</InlineAlert>}
    </>
  )
}

type DialogProps = {
  open: boolean
  mode: Mode | null
  jobs: Job[]
  states: Map<string, JobState>
  preparing: boolean
  closing: boolean
  onClose: () => void
  onSignAgain: () => void
  onShowWindow: () => void
  onRetry: () => void
  onStartAgent: () => void
  onSetupOpened: () => void
  finalFocus: () => HTMLElement | null
}

type View = {
  icon: ReactNode
  tone: "brand" | "success" | "warning" | "danger" | "neutral"
  title: string
  body?: ReactNode
  /** The outline button, left of the primary. */
  secondary?: ReactNode
  primary?: ReactNode
}

/** The footer's buttons, holding the refs that initial focus and state changes move focus to. */
type Actions = ReturnType<typeof footerActions>

function SigningDialog(props: DialogProps) {
  const { open, mode, closing, onClose } = props
  const panelRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLElement>(null)
  const secondaryRef = useRef<HTMLElement>(null)
  const view = mode && viewOf(mode, props, footerActions(props, primaryRef, secondaryRef))

  // A state change that removed the focused button moves focus to the new primary, else to Cancel or Close.
  const key = mode && [mode.kind, "state" in mode && mode.state, "variant" in mode && mode.variant].join(":")
  useEffect(() => {
    const panel = panelRef.current
    if (!key || !panel) return
    const active = document.activeElement
    if (active && active !== panel && panel.contains(active)) return
    ;(primaryRef.current ?? secondaryRef.current)?.focus()
  }, [key])

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      // "Document signed" closes by itself.
      onOpenChange={(next) => !next && mode?.kind !== "signed" && !closing && onClose()}
    >
      <DialogPortal>
        <DialogOverlay className={scrimClasses} />
        <DialogPrimitive.Popup
          ref={panelRef}
          initialFocus={() => primaryRef.current ?? secondaryRef.current ?? true}
          finalFocus={() => props.finalFocus() ?? true}
          className={cn(dialogPanel, dialogMotion, "max-w-[460px]")}
        >
          {view && (
            <>
              <div className="flex min-h-0 items-start gap-3.5 overflow-y-auto px-5.5 pt-5 pb-5">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-(--pn-r-4)",
                    view.tone === "brand" && "bg-(--pn-accent-soft) text-(--pn-accent)",
                    view.tone === "success" && "bg-(--pn-success-bg) text-(--pn-success-fg)",
                    view.tone === "warning" && "bg-(--pn-warning-bg) text-(--pn-warning-fg)",
                    view.tone === "danger" && "bg-(--pn-danger-bg) text-(--pn-danger-fg)",
                    view.tone === "neutral" && "bg-(--pn-muted) text-(--pn-fg-muted)"
                  )}
                >
                  {view.icon}
                </span>
                {/* One live region for both, so screen readers hear every new state. */}
                <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
                  <DialogTitle className={dialogTitleText}>{view.title}</DialogTitle>
                  {view.body && (
                    <DialogDescription render={<div />} className={cn(dialogDescriptionText, "mt-1")}>
                      {view.body}
                    </DialogDescription>
                  )}
                </div>
              </div>
              {(view.secondary || view.primary) && (
                <div className={dialogFooter}>
                  {view.secondary}
                  {view.primary}
                </div>
              )}
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

function footerActions(
  props: DialogProps,
  primaryRef: RefObject<HTMLElement | null>,
  secondaryRef: RefObject<HTMLElement | null>
) {
  const { closing, onClose } = props
  const signed = props.jobs.some((j) => props.states.get(j.jobId)?.status === "completed")
  // Callback refs: a link primary is an anchor, not the button the type expects.
  const setPrimary = (element: HTMLElement | null) => {
    primaryRef.current = element
  }
  const secondary = (element: HTMLElement | null) => {
    secondaryRef.current = element
  }
  return {
    /** Cancel signature, or Stop here once something is signed. */
    cancel: (
      <Button ref={secondary} variant="outline" className={dialogFooterButton} onClick={onClose}>
        {signed ? "Stop here" : "Cancel signature"}
      </Button>
    ),
    /** Close for an attempt that ended: it reloads the page first. */
    close: (primary: boolean) => (
      <LoadingButton
        ref={primary ? setPrimary : secondary}
        size="default"
        variant={primary ? "default" : "outline"}
        pending={closing}
        onClick={onClose}
      >
        Close
      </LoadingButton>
    ),
    primary: (label: ReactNode, onClick: () => void) => (
      <Button ref={setPrimary} className={dialogFooterButton} disabled={closing} onClick={onClick}>
        {label}
      </Button>
    ),
    /** A primary that is a link: the agent's own scheme, a download, a page in a new tab. */
    link: (label: ReactNode, anchor: ReactElement) => (
      <Button ref={setPrimary} className={dialogFooterButton} nativeButton={false} render={anchor}>
        {label}
      </Button>
    ),
    /** "Start PoliNetwork eSign" opens the agent's scheme; the window opens again once the browser has asked. */
    start: (label: ReactNode, quiet = false) => {
      const anchor = <a href={AGENT_LAUNCH_URL} onClick={props.onStartAgent} />
      return quiet ? (
        <Button variant="ghost" size="sm" className={buttonMotion} nativeButton={false} render={anchor}>
          {label}
        </Button>
      ) : (
        <Button ref={setPrimary} className={dialogFooterButton} nativeButton={false} render={anchor}>
          {label}
        </Button>
      )
    },
  }
}

function viewOf(mode: Mode, props: DialogProps, actions: Actions): View {
  const { jobs, states, preparing } = props
  const total = jobs.length
  const signed = jobs.filter((j) => states.get(j.jobId)?.status === "completed").length
  const spin = <LoaderCircle className="size-5 animate-spin" />
  const warning = <TriangleAlert className="size-5" />
  const start = actions.start(
    <>
      <Play aria-hidden /> Start PoliNetwork eSign
    </>
  )

  switch (mode.kind) {
    case "opening":
      return { icon: spin, tone: "brand", title: "Opening PoliNetwork eSign…", secondary: actions.cancel }
    case "blocked":
      return {
        icon: warning,
        tone: "warning",
        title: "Your browser blocked the signing window",
        body: "If nothing opens, allow pop-ups for this site.",
        secondary: actions.cancel,
        primary: actions.primary("Open the signing window", props.onRetry),
      }
    case "signing":
      return {
        icon: <KeyRound className="size-5" />,
        tone: "brand",
        title: "Type your PIN in PoliNetwork eSign",
        body: total > 1 && (
          <>
            <p>One PIN signs all {total}.</p>
            <p className="mt-3 text-[13px] font-medium text-(--pn-fg) tabular-nums">
              {signed} of {total} signed
            </p>
            <JobRows jobs={jobs} states={states} />
          </>
        ),
        secondary: actions.cancel,
        primary: actions.primary("Show the window", props.onShowWindow),
      }
    case "notRunning":
      return {
        icon: warning,
        tone: "warning",
        title: "PoliNetwork eSign isn't running on this computer",
        body: mode.variant === "install" && (
          <div className="mt-2 -ml-2.5">{actions.start("It's already installed: start it", true)}</div>
        ),
        secondary: actions.cancel,
        primary:
          mode.variant === "start"
            ? start
            : mode.setupOpened
              ? actions.primary("Try again", props.onRetry)
              : actions.link(
                  <>
                    <Download aria-hidden /> Install PoliNetwork eSign
                  </>,
                  <a href="/dashboard/esign/setup" target="_blank" rel="noreferrer" onClick={props.onSetupOpened} />
                ),
      }
    case "starting":
      return {
        icon: spin,
        tone: "brand",
        title: "Starting PoliNetwork eSign…",
        body: "If your browser asks, allow it.",
        secondary: actions.cancel,
      }
    case "stopped":
      return {
        icon: warning,
        tone: "warning",
        title: "PoliNetwork eSign stopped",
        body: signed > 0 ? `${signed} of ${total} signed.` : "Nothing was signed.",
        secondary: actions.cancel,
        primary: start,
      }
    case "fatal":
      if (mode.state === "outdated") return outdatedView(actions)
      if (mode.state === "expired") return expiredView(preparing, actions, props.onSignAgain)
      if (mode.state === "connect")
        return {
          icon: warning,
          tone: "warning",
          title: "PoliNetwork eSign can't connect",
          body: "Check the internet connection, then try again.",
          secondary: actions.cancel,
          primary: actions.primary("Try again", props.onRetry),
        }
      return {
        icon: <CircleAlert className="size-5" />,
        tone: "danger",
        title: "PoliNetwork eSign can't continue",
        body: mode.message,
        secondary: actions.cancel,
        primary: actions.primary("Try again", props.onRetry),
      }
    case "ended":
      return endedView(mode.ending, preparing, actions, props.onSignAgain)
    case "signed":
      return {
        icon: <CircleCheck className="size-5" />,
        tone: "success",
        title: total > 1 ? `${total} documents signed` : "Document signed",
      }
    case "partial":
      return {
        icon: warning,
        tone: "warning",
        title: `${signed} of ${total} signed`,
        body: <JobRows jobs={jobs} states={states} stopped />,
        primary: actions.close(true),
      }
  }
}

function outdatedView(actions: Actions): View {
  const download = agentDownload(detectOs(navigator.userAgent))
  return {
    icon: <MonitorDown className="size-5" />,
    tone: "warning",
    ...OUTDATED,
    secondary: actions.close(false),
    primary: download.direct
      ? actions.link(
          <>
            <Download aria-hidden /> {download.label}
          </>,
          <a href={download.href} />
        )
      : actions.link(download.label, <a href={download.href} target="_blank" rel="noreferrer" />),
  }
}

function expiredView(preparing: boolean, actions: Actions, onSignAgain: () => void): View {
  return {
    icon: <TriangleAlert className="size-5" />,
    tone: "neutral",
    title: "The signing window timed out",
    // A document created in the composer is signed from its request page.
    body: preparing ? "Nothing was signed. Close to open the request and sign it from there." : "Nothing was signed.",
    secondary: preparing ? undefined : actions.close(false),
    primary: preparing ? actions.close(true) : actions.primary("Sign again", onSignAgain),
  }
}

function endedView(ending: Ending, preparing: boolean, actions: Actions, onSignAgain: () => void): View {
  if (ending.reason === "outdated") return outdatedView(actions)
  if (ending.reason === "expired") return expiredView(preparing, actions, onSignAgain)
  const again = ending.extra === "again" && !preparing
  const Icon = ending.reason === "cancelled" ? Ban : ending.reason === "declined" ? X : TriangleAlert
  return {
    icon: <Icon className="size-5" />,
    tone: ending.reason === "failed" ? "danger" : "neutral",
    title: ending.title,
    body: (
      <>
        <p>{ending.body}</p>
        {ending.extra === "setup" && (
          <div className="mt-2 -ml-2.5">
            <Button
              variant="ghost"
              size="sm"
              className={buttonMotion}
              nativeButton={false}
              render={<a href="/dashboard/esign/setup" target="_blank" rel="noreferrer" />}
            >
              <MonitorDown aria-hidden /> Setup guide
            </Button>
          </div>
        )}
      </>
    ),
    secondary: again ? actions.close(false) : undefined,
    primary: again ? actions.primary("Sign again", onSignAgain) : actions.close(true),
  }
}

/** A batch's documents: signed, still waiting, or why one wasn't signed. `stopped`: nothing is waiting anymore. */
function JobRows({ jobs, states, stopped }: { jobs: Job[]; states: Map<string, JobState>; stopped?: boolean }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {jobs.map((job) => {
        const state = states.get(job.jobId)
        const done = state?.status === "completed"
        const failure = done ? null : (jobFailure(state) ?? (stopped ? "Not signed." : null))
        return (
          <li key={job.jobId} className="flex items-start gap-2 text-[13px]">
            {done ? (
              <CircleCheck aria-label="Signed" className="mt-0.5 size-4 shrink-0 text-(--pn-success-fg)" />
            ) : failure ? (
              <CircleAlert aria-label="Not signed" className="mt-0.5 size-4 shrink-0 text-(--pn-danger-fg)" />
            ) : (
              <Circle aria-label="Waiting" className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-(--pn-fg)">{job.title}</span>
              {failure && <span className="block text-pretty text-(--pn-danger-fg)">{failure}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
