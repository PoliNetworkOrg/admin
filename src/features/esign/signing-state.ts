import { AGENT_DOWNLOAD_URLS, AGENT_RELEASES_URL } from "./agent.ts"
import type { AgentFlag, Os } from "./signing-device.ts"

/** A job the signing dialog follows, with the title of its document. */
export type Job = { jobId: string; requestId: string; title: string }
export type JobState = { status: string; errorCode: string | null; errorMessage: string | null; seen: boolean }
export type JobStatus = JobState & { jobId: string }

export const OPEN_STATUSES = new Set(["pending", "prepared"])

/** How long PoliNetwork eSign has to say "ready" after its window is sent to it. */
export const READY_MS = 2500
/** The same for a browser whose agent is too old to say it: such an agent only shows by fetching its job. */
export const OLD_AGENT_READY_MS = 6000
/**
 * The same for a browser that has never run PoliNetwork eSign, or not since the dashboard started remembering it: its
 * agent may be an old one, which needs its job fetched through the backend to show.
 */
export const FIRST_READY_MS = 4000

/** The ready deadline for this browser: longer when the agent last seen here, or possibly here, is an old one. */
export function deadlineFor(flag: AgentFlag | null) {
  if (flag === null) return FIRST_READY_MS
  return flag.version === null ? OLD_AGENT_READY_MS : READY_MS
}

/**
 * "start" when PoliNetwork eSign has run in this browser, "install" when it hasn't, "failed" when Start was just
 * pressed and nothing answered.
 */
export function notRunningVariant(flag: AgentFlag | null, startFailed: boolean): "start" | "install" | "failed" {
  if (startFailed) return "failed"
  return flag !== null ? "start" : "install"
}

/** What the dialog shows for an error that stops the agent window before or instead of the PIN form. */
export type FatalState = "outdated" | "connect" | "expired" | "continue"

export function stateForFatal(code: string): FatalState {
  if (code === "agent_outdated") return "outdated"
  if (code === "backend_unreachable") return "connect"
  if (code === "job_expired") return "expired"
  return "continue"
}

type Copy = { title: string; body: string | null; extra?: "setup" | "again" }

/**
 * How the dialog words a job that failed for good, by its error code: `null` bodies take the backend's message. Never
 * says where PIN or PUK digits come from.
 */
export const TERMINAL_COPY = new Map<string, Copy>([
  [
    "pin_locked",
    {
      title: "Your PIN is blocked",
      body: "Unblock it with your PUK in the CieID app on your phone or in CIE ID on this computer, then sign again.",
    },
  ],
  [
    "middleware_missing",
    { title: "CIE ID isn't set up on this computer", body: "Follow the setup guide, then sign again.", extra: "setup" },
  ],
  [
    "not_paired",
    { title: "Pair your CIE in CIE ID", body: "Open CIE ID and pair the card, then sign again.", extra: "setup" },
  ],
  ["card_untrusted", { title: "This card can't be verified", body: "The PIN wasn't sent to it.", extra: "setup" }],
  ["card_unsupported", { title: "This card isn't supported", body: "Sign with your CIE." }],
  ["signer_mismatch", { title: "This isn't your CIE", body: "Place your own CIE on the reader.", extra: "again" }],
  ["certificate_not_found", { title: "No signing certificate on this card", body: null }],
  ["certificate_invalid", { title: "The card's certificate isn't valid", body: null }],
  ["signature_invalid", { title: "The signature didn't verify", body: "Nothing was saved.", extra: "again" }],
  ["document_changed", { title: "The document changed", body: "Someone signed it in the meantime.", extra: "again" }],
  ["pdf_invalid", { title: "This PDF can't be signed", body: null }],
  ["job_done", { title: "Nothing left to sign", body: "This request no longer needs your signature." }],
])

/** A failed job's title and body, with the backend's message where the code has no words of its own. */
export function terminalCopy(code: string | null, message: string | null) {
  const copy = (code && TERMINAL_COPY.get(code)) || { title: "Signature failed", body: null }
  return { title: copy.title, body: copy.body ?? message ?? "Nothing was signed.", extra: copy.extra ?? null }
}

const UPDATE_STEPS = {
  macos: "Download the new one, open it and open PoliNetwork eSign inside: it replaces this one.",
  windows: "Download the new one, extract it and open esign.exe: it replaces this one.",
  linux: "Update the polinetwork-esign package, or install the new one from the download page.",
} satisfies Record<Os, string>

/**
 * The Update state: the agent is older than the backend accepts. Worded as the agent window says it, whose page is
 * open beside it; on Linux PoliNetwork eSign may come from a package manager.
 */
export function outdatedCopy(os: Os) {
  return {
    title: "Update PoliNetwork eSign",
    body: `This version is too old to sign. ${UPDATE_STEPS[os]}`,
  }
}

/** How an attempt that signed nothing ended. */
export type Ending = {
  reason: "cancelled" | "declined" | "expired" | "failed" | "outdated"
  code: string | null
  title: string
  body: string
  /** "setup": the setup guide helps; "again": signing again can work. */
  extra: "setup" | "again" | null
}

/**
 * How an attempt that signed nothing ended, once none of its jobs is open: someone else cancelled or declined the
 * request, the signing window timed out, the agent is too old, or a job failed for good. Null when every job was
 * cancelled, which is the signer's own cancel (in the agent window or another tab) and needs no message.
 */
export function endingOf(statuses: JobStatus[], jobs: Job[], preparing: boolean): Ending | null {
  const titled = (status: { jobId: string }, text: string) => {
    const title = jobs.length > 1 && jobs.find((j) => j.jobId === status.jobId)?.title
    return title ? `${title}: ${text}` : text
  }
  const foreign = statuses.find(
    (s) => s.status === "cancelled" && (s.errorCode === "request_cancelled" || s.errorCode === "request_declined")
  )
  if (foreign) {
    const declined = foreign.errorCode === "request_declined"
    return {
      reason: declined ? "declined" : "cancelled",
      code: foreign.errorCode,
      title: declined ? "Request declined" : "Request cancelled",
      body: titled(foreign, foreign.errorMessage ?? "Nothing was signed."),
      extra: null,
    }
  }
  if (statuses.some((s) => s.status === "expired"))
    return {
      reason: "expired",
      code: null,
      title: "The signing window timed out",
      body: preparing ? "Nothing was signed. Close to open the request and sign it from there." : "Nothing was signed.",
      extra: preparing ? null : "again",
    }
  const failed = statuses.find((s) => s.status === "failed")
  if (!failed) return null
  // The dialog words the update for the computer's system (outdatedCopy).
  if (failed.errorCode === "agent_outdated")
    return { reason: "outdated", code: failed.errorCode, ...outdatedCopy("macos"), extra: null }
  const copy = terminalCopy(failed.errorCode, failed.errorMessage)
  return { reason: "failed", code: failed.errorCode, ...copy, body: titled(failed, copy.body) }
}

/** Where a job stands once none is open, or that some still are. */
export type Outcome =
  | { kind: "open" }
  | { kind: "signed" }
  | { kind: "partial"; signed: number }
  | { kind: "ended"; ending: Ending }
  | { kind: "dismissed" }

export function outcomeOf(statuses: JobStatus[], jobs: Job[], preparing: boolean): Outcome {
  if (statuses.some((s) => OPEN_STATUSES.has(s.status))) return { kind: "open" }
  const signed = statuses.filter((s) => s.status === "completed").length
  if (signed === jobs.length) return { kind: "signed" }
  if (signed > 0) return { kind: "partial", signed }
  const ending = endingOf(statuses, jobs, preparing)
  return ending ? { kind: "ended", ending } : { kind: "dismissed" }
}

/**
 * What to do once the signer closed the agent window (read closed on two polls in a row): before the agent answered,
 * it isn't running; while the card is signing, wait for it; with documents signed, show which; else it was a cancel.
 */
export function closedWindowAction(answered: boolean, statuses: JobStatus[]) {
  if (!answered) return "notRunning"
  if (statuses.some((s) => s.status === "prepared")) return "wait"
  if (statuses.some((s) => s.status === "completed")) return "partial"
  return "dismiss"
}

/** A batch row's reason for a document that wasn't signed; null while it can still be. */
export function jobFailure(state: JobState | undefined) {
  if (!state || state.status === "completed" || OPEN_STATUSES.has(state.status)) return null
  if (state.status === "expired") return "The signing window timed out."
  if (state.status === "cancelled")
    return state.errorCode === "request_cancelled" || state.errorCode === "request_declined"
      ? (state.errorMessage ?? "Not signed.")
      : "Not signed."
  if (state.errorCode === "agent_outdated") return "This version of PoliNetwork eSign is too old to sign."
  const copy = terminalCopy(state.errorCode, state.errorMessage)
  return `${copy.title}. ${copy.body}`
}

/** The newest PoliNetwork eSign for this computer: the file itself on macOS and Windows, the release page on Linux. */
export function agentDownload(os: Os) {
  if (os === "linux") return { href: AGENT_RELEASES_URL, label: "Open the download page", direct: false }
  return {
    href: AGENT_DOWNLOAD_URLS[os],
    label: os === "windows" ? "Download for Windows" : "Download for macOS",
    direct: true,
  }
}
