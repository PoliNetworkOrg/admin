import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Circle,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  MonitorDown,
  PenLine,
  Play,
  TriangleAlert,
} from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

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
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { AGENT_LAUNCH_URL, agentSignUrl, isAgentOrigin } from "./agent"
import { cancelEsignSignature, getEsignJobStatus, startEsignSignature } from "./esign.functions"
import type { BoxPlacement } from "./signature-box"

/** A document to sign; `places` are the signer's boxes as they dragged them, one per place, in order. */
export type SignItem = { requestId: string; title: string; places?: BoxPlacement[] }

type Job = { jobId: string; requestId: string; title: string }
type JobState = { status: string; errorCode: string | null; errorMessage: string | null; seen: boolean }

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; jobs: Job[]; url: string; since: number }
  | { kind: "signing"; jobs: Job[]; url: string }
  | { kind: "ended"; reason: "cancelled" | "expired" | "failed"; message: string }
type Shown = Exclude<Phase, { kind: "starting" }>

const POLL_MS = 1200
/** After this long without the agent fetching the job, it is probably not running. */
const AGENT_TIMEOUT_MS = 7000
const OPEN = new Set(["pending", "prepared"])

/** What the agent reported, by its error code (esign `internal/token`, backend `agent_outdated`). */
const AGENT_ERRORS = new Map([
  ["pin_incorrect", "Wrong PIN. Type it again in the PoliNetwork eSign window."],
  ["pin_locked", "The PIN is blocked. Unblock it with the PUK in the CIE ID app, then try again."],
  ["pin_invalid", "The PIN must be the 8 digits of your CIE PIN."],
  ["no_card", "PoliNetwork eSign can't see the card. Place the CIE on the reader."],
  ["no_reader", "PoliNetwork eSign can't find an NFC reader. Connect it and try again."],
  ["card_removed", "The card moved away from the reader. Keep it still and try again."],
  ["middleware_missing", "PoliNetwork eSign found no CIE software. Open the setup guide."],
  ["not_paired", "This CIE is not set up on this computer yet. Open the setup guide."],
  ["card_unsupported", "This card isn't a supported CIE."],
  ["card_untrusted", "The card couldn't be verified as a genuine CIE, so the PIN wasn't sent to it."],
  ["device_error", "The card couldn't complete the signature. Try again."],
  ["signature_invalid", "The card's signature didn't match. Try again."],
  [
    "agent_outdated",
    "This version of the signing app is too old. Install the latest PoliNetwork eSign from the setup guide.",
  ],
])

function errorText(state: JobState | undefined) {
  if (!state?.errorCode || state.errorCode === "cancelled") return null
  return AGENT_ERRORS.get(state.errorCode) ?? state.errorMessage ?? "The signature failed. Try again."
}

/** The agent window's size, centered horizontally over the dashboard window. */
function popupFeatures() {
  const width = 460
  const height = 680
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 3)
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`
}

function openPopup(): Window | null {
  // A new name each time: a window still showing the agent's page is cross-origin, and writing to it would throw.
  const popup = window.open("", `pn-esign-${Date.now()}`, popupFeatures())
  if (popup) {
    popup.document.title = "PoliNetwork eSign"
    // The agent page's canvas and muted text (sign-agent internal/server/web/assets/style.css), following the OS
    // scheme as that page does rather than the dashboard's theme, so the page takes over without a change of colour.
    popup.document.documentElement.style.colorScheme = "light dark"
    popup.document.body.style.cssText =
      "font:15px system-ui,sans-serif;background:#f6f7f9;background:light-dark(#f6f7f9,#060e16);color:#58626c;color:light-dark(#58626c,#9da6ae);display:grid;place-items:center;height:90vh;margin:0"
    popup.document.body.textContent = "Opening PoliNetwork eSign…"
  }
  return popup
}

/**
 * "Sign with CIE": starts the signature of one or more documents, opens the agent's page in a popup (where one PIN
 * signs them all) and follows the jobs until every signature is saved. The dashboard never talks to the agent:
 * browsers block HTTPS pages from fetching loopback addresses, but they allow opening a window there.
 */
export function SignWithCie({
  items,
  prepare,
  disabled,
  children,
  onSigned,
  onStopped,
}: (
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
  disabled?: boolean
  children?: ReactNode
  /** After the signatures are saved and the page data reloaded. */
  onSigned?: () => void
  /** After the dialog closes before every document is signed, or the signature couldn't start (with why). */
  onStopped?: (error: string | null) => void
}) {
  const router = useRouter()
  const startFn = useServerFn(startEsignSignature)
  const cancelFn = useServerFn(cancelEsignSignature)
  const statusFn = useServerFn(getEsignJobStatus)
  const [phase, setPhase] = useState<Phase | null>(null)
  // The last phase the dialog showed: its content stays while the dialog animates out.
  const [shown, setShown] = useState<Shown | null>(null)
  const [states, setStates] = useState<Map<string, JobState>>(new Map())
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const [windowClosed, setWindowClosed] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const finishing = useRef(false)

  const reload = useCallback(async () => {
    try {
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
    }
  }, [router])

  const finish = useCallback(
    async (count: number, total: number) => {
      if (finishing.current) return
      finishing.current = true
      await reload()
      setPhase(null)
      popupRef.current = null
      if (count === total) appToast.success(count === 1 ? "Document signed." : `${count} documents signed.`)
      else appToast.warning(`${count} of ${total} documents signed.`)
      onSigned?.()
    },
    [reload, onSigned]
  )

  const jobs = phase && "jobs" in phase ? phase.jobs : null

  useEffect(() => {
    if (!jobs) return
    let stopped = false
    const poll = async () => {
      // Readable only while the dashboard keeps its opener relationship with the window: the agent sends no COOP
      // header, and the dashboard must not send `Cross-Origin-Opener-Policy: same-origin`.
      const closedBefore = popupRef.current?.closed === true
      try {
        const statuses = await statusFn({ data: { jobIds: jobs.map((j) => j.jobId) } })
        if (stopped) return
        setStates(new Map(statuses.map((s) => [s.jobId, s])))
        const done = statuses.filter((s) => s.status === "completed").length
        const ended = statuses.find((s) => s.status !== "completed" && !OPEN.has(s.status))
        if (statuses.every((s) => !OPEN.has(s.status))) {
          if (done > 0 || !ended) return void finish(done, jobs.length)
          const reason = ended.status === "expired" ? "expired" : ended.status === "cancelled" ? "cancelled" : "failed"
          setPhase({
            kind: "ended",
            reason,
            message:
              reason === "expired"
                ? "The signing link expired. Start again."
                : reason === "cancelled"
                  ? "The signature was cancelled."
                  : (ended.errorMessage ?? "The signature failed."),
          })
          return
        }
        // Closed before and after the request, so a window opened again meanwhile counts as open. The agent closes
        // its window on cancel or success only after the backend recorded it, so those end above.
        setWindowClosed(closedBefore && popupRef.current?.closed === true)
        if (statuses.some((s) => s.seen))
          setPhase((current) => (current?.kind === "waiting" ? { kind: "signing", jobs, url: current.url } : current))
      } catch (cause) {
        console.error(cause)
      }
    }
    const timer = window.setInterval(poll, POLL_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    function onMessage(event: MessageEvent) {
      // Agents up to v0.1.x, named PoliNetwork Sign Agent, post "pn-sign-agent".
      if (!isAgentOrigin(event.origin) || !["pn-esign", "pn-sign-agent"].includes(event.data?.type)) return
      void poll()
    }
    window.addEventListener("message", onMessage)
    return () => {
      stopped = true
      window.clearInterval(timer)
      window.clearInterval(tick)
      window.removeEventListener("message", onMessage)
    }
  }, [jobs, statusFn, finish])

  async function start() {
    const prepared = prepare ? prepare() : Promise.resolve(items ?? [])
    if (!prepared) return
    setError(null)
    setStates(new Map())
    setWindowClosed(false)
    finishing.current = false
    popupRef.current?.close()
    let popup: Window | null = null
    try {
      // Opened synchronously in the click, so the browser doesn't block it.
      popup = openPopup()
      popupRef.current = popup
      setPhase({ kind: "starting" })
      const toSign = await prepared
      if (toSign.length === 0) {
        popup?.close()
        setPhase(null)
        return
      }
      const started = await startFn({
        data: { items: toSign.map((item) => ({ requestId: item.requestId, places: item.places })) },
      })
      const url = agentSignUrl(
        started.map((s) => s.ticket),
        window.location.origin
      )
      if (popup && !popup.closed) popup.location.href = url
      const titles = new Map(toSign.map((item) => [item.requestId, item.title]))
      setPhase({
        kind: "waiting",
        jobs: started.map((s) => ({ jobId: s.jobId, requestId: s.requestId, title: titles.get(s.requestId) ?? "" })),
        url,
        since: Date.now(),
      })
      setNow(Date.now())
    } catch (cause) {
      console.error(cause)
      popup?.close()
      setPhase(null)
      const message = cause instanceof Error ? cause.message : "Couldn't start the signature."
      setError(message)
      onStopped?.(message)
    }
  }

  /** Closes the dialog, cancelling what isn't signed yet; reloads when part of a batch was signed. */
  async function close() {
    if (finishing.current) return
    finishing.current = true
    const current = phase
    setPhase(null)
    popupRef.current?.close()
    if (!current || !("jobs" in current)) return onStopped?.(null)
    const open = current.jobs.filter((j) => OPEN.has(states.get(j.jobId)?.status ?? "pending"))
    if (open.length > 0) {
      try {
        await cancelFn({ data: { jobIds: open.map((j) => j.jobId) } })
      } catch (cause) {
        console.error(cause)
      }
    }
    if (open.length < current.jobs.length) await reload()
    onStopped?.(null)
  }

  /** Brings the agent window to the front without reloading it (the PIN may be half typed), or opens it again. */
  function showWindow(url: string) {
    const popup = popupRef.current
    if (popup && !popup.closed) popup.focus()
    else popupRef.current = window.open(url, `pn-esign-${Date.now()}`, popupFeatures())
    setWindowClosed(false)
  }

  /** Loads the signing page again in the agent window, opening a new one if it was closed. */
  function openWindowAgain(url: string) {
    const popup = popupRef.current
    if (popup && !popup.closed) popup.location.href = url
    showWindow(url)
  }

  if (phase && phase.kind !== "starting" && phase !== shown) setShown(phase)
  const active = shown && shown.kind !== "ended" ? shown : null
  const batch = (active?.jobs ?? items ?? []).length > 1
  const silent = active?.kind === "waiting" && now - active.since > AGENT_TIMEOUT_MS
  const signed = active?.jobs.filter((j) => states.get(j.jobId)?.status === "completed").length ?? 0
  const openJobs = active?.jobs.filter((j) => OPEN.has(states.get(j.jobId)?.status ?? "pending")) ?? []
  // Every document is signed or ended: the poll is finishing and the page reloads.
  const settled = active !== null && signed > 0 && openJobs.length === 0
  // A failure every open document shares (a wrong PIN, no card) is shown once, above the list.
  const firstCode = openJobs[0] && states.get(openJobs[0].jobId)?.errorCode
  const sharedCode = firstCode && openJobs.every((j) => states.get(j.jobId)?.errorCode === firstCode) ? firstCode : null
  const sharedError = sharedCode && openJobs[0] ? errorText(states.get(openJobs[0].jobId)) : null
  const total = active?.jobs.length ?? 0
  const jobList = active && (
    <ul className="mt-2 flex flex-col gap-2" aria-live="polite">
      {active.jobs.map((job) => (
        <JobRow key={job.jobId} job={job} state={states.get(job.jobId)} hideError={sharedCode !== null} />
      ))}
    </ul>
  )
  const progress = batch && (
    <>
      <p className="mt-3 text-[13px] font-medium text-(--pn-fg) tabular-nums">
        {signed} of {pluralize(total, "document")} signed
      </p>
      {jobList}
    </>
  )

  return (
    <>
      <LoadingButton
        icon={PenLine}
        pending={phase?.kind === "starting"}
        disabled={disabled || items?.length === 0}
        onClick={start}
        className="h-10"
      >
        {children ?? (items && items.length > 1 ? `Sign ${items.length} documents` : "Sign with CIE")}
      </LoadingButton>
      {error && <InlineAlert className="mt-2">{error}</InlineAlert>}
      <Dialog
        open={phase !== null && phase.kind !== "starting"}
        disablePointerDismissal
        onOpenChange={(open) => !open && void close()}
      >
        <DialogPortal>
          <DialogOverlay className={scrimClasses} />
          <DialogPrimitive.Popup className={cn(dialogPanel, dialogMotion, "max-w-[460px]")}>
            {shown?.kind === "ended" ? (
              <Status
                icon={
                  shown.reason === "cancelled" ? (
                    <CircleCheck className="size-5" />
                  ) : (
                    <TriangleAlert className="size-5" />
                  )
                }
                tone={shown.reason === "failed" ? "danger" : "neutral"}
                title={
                  shown.reason === "expired"
                    ? "The link expired"
                    : shown.reason === "cancelled"
                      ? "Signature cancelled"
                      : "Signature failed"
                }
              >
                {shown.message}
              </Status>
            ) : settled ? (
              <Status
                icon={signed === total ? <CircleCheck className="size-5" /> : <TriangleAlert className="size-5" />}
                tone={signed === total ? "success" : "warning"}
                title={
                  signed < total
                    ? `${signed} of ${pluralize(total, "document")} signed`
                    : total === 1
                      ? "Document signed"
                      : `${pluralize(total, "document")} signed`
                }
              >
                {batch ? jobList : "Updating the page…"}
              </Status>
            ) : active?.kind === "waiting" && silent ? (
              <Status
                icon={<TriangleAlert className="size-5" />}
                tone="warning"
                title="PoliNetwork eSign isn't answering"
              >
                <p>
                  Start PoliNetwork eSign, then open its window again. First time here? Install it from the setup guide.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={buttonMotion}
                    nativeButton={false}
                    render={<a href={AGENT_LAUNCH_URL} />}
                  >
                    <Play aria-hidden /> Start PoliNetwork eSign
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={buttonMotion}
                    onClick={() => openWindowAgain(active.url)}
                  >
                    <ExternalLink aria-hidden /> Open the window again
                  </Button>
                  <SetupGuideButton />
                </div>
              </Status>
            ) : active && windowClosed ? (
              <Status
                icon={<TriangleAlert className="size-5" />}
                tone="warning"
                title="The PoliNetwork eSign window was closed"
              >
                <p>
                  {signed === 0
                    ? "Nothing was signed. Open the window again to type your PIN, or cancel."
                    : `${signed} of ${pluralize(total, "document")} are signed. Open the window again to sign the others, or stop here.`}
                </p>
                {sharedError && <InlineAlert className="mt-3">{sharedError}</InlineAlert>}
                {batch && jobList}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(buttonMotion, "mt-3")}
                  onClick={() => showWindow(active.url)}
                >
                  <ExternalLink aria-hidden /> Open the window again
                </Button>
              </Status>
            ) : active?.kind === "waiting" ? (
              <Status icon={<LoaderCircle className="size-5 animate-spin" />} title="Opening PoliNetwork eSign">
                A PoliNetwork eSign window opens on this computer.
              </Status>
            ) : active ? (
              <Status icon={<KeyRound className="size-5" />} title="Type your PIN in PoliNetwork eSign">
                <p>
                  Keep the CIE on the reader. {batch ? `One PIN signs all ${total} documents. ` : ""}
                  The PIN goes only to the card, never to PoliNetwork.
                </p>
                {sharedError && <InlineAlert className="mt-3">{sharedError}</InlineAlert>}
                {progress}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(buttonMotion, "mt-2 -ml-2")}
                  onClick={() => showWindow(active.url)}
                >
                  <ExternalLink aria-hidden /> Show the PoliNetwork eSign window
                </Button>
              </Status>
            ) : null}
            {shown?.kind === "ended" ? (
              <div className={dialogFooter}>
                <Button className={dialogFooterButton} onClick={() => void close()}>
                  Close
                </Button>
              </div>
            ) : (
              !settled && (
                <div className={dialogFooter}>
                  <Button variant="outline" className={dialogFooterButton} onClick={() => void close()}>
                    {signed > 0 ? "Stop here" : "Cancel signature"}
                  </Button>
                </div>
              )
            )}
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>
    </>
  )
}

function SetupGuideButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={buttonMotion}
      nativeButton={false}
      render={<a href="/dashboard/esign/setup" target="_blank" rel="noreferrer" />}
    >
      <MonitorDown aria-hidden /> Setup guide
    </Button>
  )
}

function JobRow({ job, state, hideError }: { job: Job; state: JobState | undefined; hideError: boolean }) {
  const done = state?.status === "completed"
  const failure = done || hideError ? null : errorText(state)
  const notSigned = failure !== null || (state !== undefined && !done && !OPEN.has(state.status))
  return (
    <li className="flex items-start gap-2 text-[13px]">
      {done ? (
        <CircleCheck aria-label="Signed" className="mt-0.5 size-4 shrink-0 text-(--pn-success-fg)" />
      ) : notSigned ? (
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
}

function Status({
  icon,
  title,
  tone = "brand",
  children,
}: {
  icon: ReactNode
  title: string
  tone?: "brand" | "success" | "warning" | "danger" | "neutral"
  children: ReactNode
}) {
  return (
    <div className="flex min-h-0 items-start gap-3.5 overflow-y-auto px-5.5 pt-5 pb-5">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-(--pn-r-4)",
          tone === "brand" && "bg-(--pn-accent-soft) text-(--pn-accent)",
          tone === "success" && "bg-(--pn-success-bg) text-(--pn-success-fg)",
          tone === "warning" && "bg-(--pn-warning-bg) text-(--pn-warning-fg)",
          tone === "danger" && "bg-(--pn-danger-bg) text-(--pn-danger-fg)",
          tone === "neutral" && "bg-(--pn-muted) text-(--pn-fg-muted)"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle className={dialogTitleText}>{title}</DialogTitle>
        <DialogDescription render={<div />} className={cn(dialogDescriptionText, "mt-1")}>
          {children}
        </DialogDescription>
      </div>
    </div>
  )
}
