import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
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
import { cn } from "@/lib/utils"

import { AGENT_LAUNCH_URL, agentSignUrl, isAgentOrigin } from "./agent"
import { cancelEsignSignature, getEsignJobStatus, startEsignSignature } from "./esign.functions"
import type { BoxPlacement } from "./signature-box"

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; jobId: string; url: string; since: number }
  | { kind: "pin"; jobId: string; url: string; errorCode: string | null; errorMessage: string | null }
  | { kind: "ended"; reason: "cancelled" | "expired" | "failed"; message: string }

const POLL_MS = 1200
/** After this long without the agent fetching the job, it is probably not running. */
const AGENT_TIMEOUT_MS = 7000

/** What the agent reported, by its error code (sign-agent `internal/token`). */
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
  ["device_error", "The card couldn't complete the signature. Try again."],
  ["signature_invalid", "The card's signature didn't match. Try again."],
])

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
 * "Sign with CIE": starts a signature job, opens the agent's page in a popup (where the PIN is typed) and follows the
 * job until the signature is saved. The dashboard never talks to the agent: browsers block HTTPS pages from fetching
 * loopback addresses, but they allow opening a window there.
 */
export function SignWithCie({
  requestId,
  placement,
  disabled,
  children = "Sign with CIE",
}: {
  requestId: string
  placement?: BoxPlacement
  disabled?: boolean
  children?: ReactNode
}) {
  const router = useRouter()
  const startFn = useServerFn(startEsignSignature)
  const cancelFn = useServerFn(cancelEsignSignature)
  const statusFn = useServerFn(getEsignJobStatus)
  const [phase, setPhase] = useState<Phase | null>(null)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const finishing = useRef(false)

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    setPhase(null)
    appToast.success("Document signed.")
    try {
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
    }
  }, [router])

  const jobId = phase && "jobId" in phase ? phase.jobId : null

  useEffect(() => {
    if (!jobId) return
    let stopped = false
    const poll = async () => {
      try {
        const status = await statusFn({ data: { jobId } })
        if (stopped) return
        if (status.status === "completed") return void finish()
        if (status.status === "cancelled" || status.status === "expired" || status.status === "failed") {
          setPhase({
            kind: "ended",
            reason: status.status,
            message:
              status.status === "expired"
                ? "The signing link expired. Start again."
                : status.status === "cancelled"
                  ? "The signature was cancelled."
                  : (status.errorMessage ?? "The signature failed."),
          })
          return
        }
        setPhase((current) => {
          if (!current || !("jobId" in current) || current.jobId !== jobId) return current
          if (!status.seen) return current
          return {
            kind: "pin",
            jobId,
            url: current.url,
            errorCode: status.errorCode,
            errorMessage: status.errorMessage,
          }
        })
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
  }, [jobId, statusFn, finish])

  async function start() {
    setError(null)
    finishing.current = false
    popupRef.current?.close()
    let popup: Window | null = null
    try {
      // Opened synchronously in the click, so the browser doesn't block it.
      popup = openPopup()
      popupRef.current = popup
      setPhase({ kind: "starting" })
      const job = await startFn({ data: { requestId, placement } })
      const url = agentSignUrl(job.ticket, window.location.origin)
      if (popup && !popup.closed) popup.location.href = url
      setPhase({ kind: "waiting", jobId: job.jobId, url, since: Date.now() })
      setNow(Date.now())
    } catch (cause) {
      console.error(cause)
      popup?.close()
      setPhase(null)
      setError(cause instanceof Error ? cause.message : "Couldn't start the signature.")
    }
  }

  async function cancel() {
    const current = phase
    setPhase(null)
    popupRef.current?.close()
    if (current && "jobId" in current) {
      try {
        await cancelFn({ data: { jobId: current.jobId } })
      } catch (cause) {
        console.error(cause)
      }
    }
  }

  function reopen(url: string) {
    popupRef.current = window.open(url, "pn-sign-agent", "popup=yes,width=460,height=680")
  }

  const silent = phase?.kind === "waiting" && now - phase.since > AGENT_TIMEOUT_MS

  return (
    <>
      <LoadingButton
        icon={PenLine}
        pending={phase?.kind === "starting"}
        disabled={disabled}
        onClick={start}
        className="h-10"
      >
        {children}
      </LoadingButton>
      {error && <InlineAlert className="mt-2">{error}</InlineAlert>}
      <Dialog open={phase !== null && phase.kind !== "starting"} onOpenChange={(open) => !open && void cancel()}>
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
          {phase?.kind === "pin" && (
            <Status icon={<KeyRound className="size-5" />} title="Type your PIN in the agent window">
              <p>Keep the CIE on the reader. The PIN goes only to the card, never to PoliNetwork.</p>
              {phase.errorCode && phase.errorCode !== "cancelled" && (
                <InlineAlert className="mt-3">
                  {AGENT_ERRORS.get(phase.errorCode) ?? phase.errorMessage ?? "The signature failed. Try again."}
                </InlineAlert>
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
              <Button
                className="h-10"
                onClick={() => {
                  popupRef.current?.close()
                  setPhase(null)
                }}
              >
                Close
              </Button>
            ) : (
              <Button variant="outline" className="h-10" onClick={() => void cancel()}>
                Cancel signature
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
