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

import { InlineAlert, LoadingButton } from "@/components/primitives"
import {
  dialogDescriptionText,
  dialogFooter,
  dialogPanel,
  dialogTitleText,
} from "@/components/primitives/confirm-dialog"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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

const POLL_MS = 1200
/** After this long without the agent fetching the job, it is probably not running. */
const AGENT_TIMEOUT_MS = 7000
const OPEN = new Set(["pending", "prepared"])

/** What the agent reported, by its error code (sign-agent `internal/token`, backend `agent_outdated`). */
const AGENT_ERRORS = new Map([
  ["pin_incorrect", "Wrong PIN. Type it again in the agent window; after 3 wrong attempts the card blocks it."],
  ["pin_locked", "The PIN is blocked. Unblock it with the PUK in the CIE ID app, then try again."],
  ["pin_invalid", "The PIN must be the 8 digits of your CIE PIN."],
  ["no_card", "The agent can't see the card. Place the CIE on the reader."],
  ["no_reader", "The agent can't find an NFC reader. Connect it and try again."],
  ["card_removed", "The card moved away from the reader. Keep it still and try again."],
  ["middleware_missing", "The agent found no CIE software. Open the setup guide."],
  ["not_paired", "This CIE is not set up on this computer yet. Open the setup guide."],
  ["card_unsupported", "This card isn't a supported CIE."],
  ["card_untrusted", "The card couldn't be verified as a genuine CIE, so the PIN wasn't sent to it."],
  ["device_error", "The card couldn't complete the signature. Try again."],
  ["signature_invalid", "The card's signature didn't match. Try again."],
  ["agent_outdated", "This version of the Sign Agent is too old. Install the latest one from the setup guide."],
])

function errorText(state: JobState | undefined) {
  if (!state?.errorCode || state.errorCode === "cancelled") return null
  return AGENT_ERRORS.get(state.errorCode) ?? state.errorMessage ?? "The signature failed. Try again."
}

function openPopup(): Window | null {
  const width = 460
  const height = 680
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 3)
  // A new name each time: a window still showing the agent's page is cross-origin, and writing to it would throw.
  const name = `pn-sign-agent-${Date.now()}`
  const popup = window.open("", name, `popup=yes,width=${width},height=${height},left=${left},top=${top}`)
  if (popup) {
    popup.document.title = "PoliNetwork Sign Agent"
    popup.document.body.style.cssText =
      "font:15px system-ui,sans-serif;color:#58626c;display:grid;place-items:center;height:90vh;margin:0"
    popup.document.body.textContent = "Opening the PoliNetwork Sign Agent…"
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
  disabled,
  children,
  onSigned,
}: {
  items: SignItem[]
  disabled?: boolean
  children?: ReactNode
  /** After the signatures are saved and the page data reloaded. */
  onSigned?: () => void
}) {
  const router = useRouter()
  const startFn = useServerFn(startEsignSignature)
  const cancelFn = useServerFn(cancelEsignSignature)
  const statusFn = useServerFn(getEsignJobStatus)
  const [phase, setPhase] = useState<Phase | null>(null)
  const [states, setStates] = useState<Map<string, JobState>>(new Map())
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const finishing = useRef(false)
  const batch = items.length > 1

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
      setPhase(null)
      popupRef.current = null
      if (count === total) appToast.success(count === 1 ? "Document signed." : `${count} documents signed.`)
      else appToast.warning(`${count} of ${total} documents signed.`)
      await reload()
      onSigned?.()
    },
    [reload, onSigned]
  )

  const jobs = phase && "jobs" in phase ? phase.jobs : null

  useEffect(() => {
    if (!jobs) return
    let stopped = false
    const poll = async () => {
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
        if (statuses.some((s) => s.seen))
          setPhase((current) => (current?.kind === "waiting" ? { kind: "signing", jobs, url: current.url } : current))
      } catch (cause) {
        console.error(cause)
      }
    }
    const timer = window.setInterval(poll, POLL_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    function onMessage(event: MessageEvent) {
      if (!isAgentOrigin(event.origin) || event.data?.type !== "pn-sign-agent") return
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
    setError(null)
    setStates(new Map())
    finishing.current = false
    popupRef.current?.close()
    let popup: Window | null = null
    try {
      // Opened synchronously in the click, so the browser doesn't block it.
      popup = openPopup()
      popupRef.current = popup
      setPhase({ kind: "starting" })
      const started = await startFn({
        data: { items: items.map((item) => ({ requestId: item.requestId, places: item.places })) },
      })
      const url = agentSignUrl(
        started.map((s) => s.ticket),
        window.location.origin
      )
      if (popup && !popup.closed) popup.location.href = url
      const titles = new Map(items.map((item) => [item.requestId, item.title]))
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
      setError(cause instanceof Error ? cause.message : "Couldn't start the signature.")
    }
  }

  /** Closes the dialog, cancelling what isn't signed yet; reloads when part of a batch was signed. */
  async function close() {
    const current = phase
    setPhase(null)
    popupRef.current?.close()
    if (!current || !("jobs" in current)) return
    const open = current.jobs.filter((j) => OPEN.has(states.get(j.jobId)?.status ?? "pending"))
    if (open.length > 0) {
      try {
        await cancelFn({ data: { jobIds: open.map((j) => j.jobId) } })
      } catch (cause) {
        console.error(cause)
      }
    }
    if (open.length < current.jobs.length) await reload()
  }

  function reopen(url: string) {
    popupRef.current = window.open(url, "pn-sign-agent", "popup=yes,width=460,height=680")
  }

  const silent = phase?.kind === "waiting" && now - phase.since > AGENT_TIMEOUT_MS
  const signed = jobs?.filter((j) => states.get(j.jobId)?.status === "completed").length ?? 0
  // A failure every open document shares (a wrong PIN, no card) is shown once, above the list.
  const open = jobs?.filter((j) => OPEN.has(states.get(j.jobId)?.status ?? "pending")) ?? []
  const firstCode = open[0] && states.get(open[0].jobId)?.errorCode
  const sharedCode = firstCode && open.every((j) => states.get(j.jobId)?.errorCode === firstCode) ? firstCode : null
  const sharedError = sharedCode && open[0] ? errorText(states.get(open[0].jobId)) : null

  return (
    <>
      <LoadingButton
        icon={PenLine}
        pending={phase?.kind === "starting"}
        disabled={disabled || items.length === 0}
        onClick={start}
        className="h-10"
      >
        {children ?? (batch ? `Sign ${items.length} documents` : "Sign with CIE")}
      </LoadingButton>
      {error && <InlineAlert className="mt-2">{error}</InlineAlert>}
      <Dialog open={phase !== null && phase.kind !== "starting"} onOpenChange={(open) => !open && void close()}>
        <DialogContent className={cn(dialogPanel, "max-w-[460px]")} showCloseButton={false}>
          {phase?.kind === "waiting" && !silent && (
            <Status icon={<LoaderCircle className="size-5 animate-spin" />} title="Opening the Sign Agent">
              A window from the PoliNetwork Sign Agent opens on this computer. If it doesn't, open it again.
            </Status>
          )}
          {phase?.kind === "waiting" && silent && (
            <Status icon={<TriangleAlert className="size-5" />} tone="warning" title="The Sign Agent isn't answering">
              <p>
                Start the agent, then open the signing window again. First time here? Install it from the setup guide.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={AGENT_LAUNCH_URL} />}>
                  <Play aria-hidden /> Start the agent
                </Button>
                <Button variant="outline" size="sm" onClick={() => reopen(phase.url)}>
                  <ExternalLink aria-hidden /> Open the window again
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<a href="/dashboard/esign/setup" target="_blank" rel="noreferrer" />}
                >
                  <MonitorDown aria-hidden /> Setup guide
                </Button>
              </div>
            </Status>
          )}
          {phase?.kind === "signing" && (
            <Status icon={<KeyRound className="size-5" />} title="Type your PIN in the agent window">
              <p>
                Keep the CIE on the reader. {batch ? `One PIN signs all ${phase.jobs.length} documents. ` : ""}
                The PIN goes only to the card, never to PoliNetwork.
              </p>
              {sharedError && <InlineAlert className="mt-3">{sharedError}</InlineAlert>}
              {batch && (
                <>
                  <p className="mt-3 text-[13px] font-medium text-(--pn-fg) tabular-nums">
                    {signed} of {pluralize(phase.jobs.length, "document")} signed
                  </p>
                  <ul className="mt-2 flex flex-col gap-2" aria-live="polite">
                    {phase.jobs.map((job) => (
                      <JobRow key={job.jobId} job={job} state={states.get(job.jobId)} hideError={sharedCode !== null} />
                    ))}
                  </ul>
                </>
              )}
              <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => reopen(phase.url)}>
                <ExternalLink aria-hidden /> Show the agent window
              </Button>
            </Status>
          )}
          {phase?.kind === "ended" && (
            <Status
              icon={
                phase.reason === "cancelled" ? <CircleCheck className="size-5" /> : <TriangleAlert className="size-5" />
              }
              tone={phase.reason === "failed" ? "danger" : "neutral"}
              title={
                phase.reason === "expired"
                  ? "The link expired"
                  : phase.reason === "cancelled"
                    ? "Signature cancelled"
                    : "Signature failed"
              }
            >
              {phase.message}
            </Status>
          )}
          <div className={dialogFooter}>
            {phase?.kind === "ended" ? (
              <Button className="h-10" onClick={() => void close()}>
                Close
              </Button>
            ) : signed > 0 ? (
              <Button variant="outline" className="h-10" onClick={() => void close()}>
                Stop here
              </Button>
            ) : (
              <Button variant="outline" className="h-10" onClick={() => void close()}>
                Cancel signature
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function JobRow({ job, state, hideError }: { job: Job; state: JobState | undefined; hideError: boolean }) {
  const done = state?.status === "completed"
  const failure = done || hideError ? null : errorText(state)
  return (
    <li className="flex items-start gap-2 text-[13px]">
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
}

function Status({
  icon,
  title,
  tone = "brand",
  children,
}: {
  icon: ReactNode
  title: string
  tone?: "brand" | "warning" | "danger" | "neutral"
  children: ReactNode
}) {
  return (
    <div className="flex gap-4 p-6 pb-2">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-(--pn-r-4)",
          tone === "brand" && "bg-(--pn-accent-soft) text-(--pn-accent)",
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
