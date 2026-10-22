import assert from "node:assert/strict"
import test from "node:test"

import { AGENT_DOWNLOAD_URLS, AGENT_RELEASES_URL } from "../src/features/esign/agent.ts"
import {
  agentDownload,
  closedWindowAction,
  deadlineFor,
  endingOf,
  FIRST_READY_MS,
  jobFailure,
  notRunningVariant,
  OLD_AGENT_READY_MS,
  outcomeOf,
  outdatedCopy,
  READY_MS,
  stateForFatal,
  TERMINAL_COPY,
  terminalCopy,
} from "../src/features/esign/signing-state.ts"

function job(jobId, status, errorCode = null, errorMessage = null) {
  return { jobId, status, errorCode, errorMessage, seen: true }
}

const ONE = [{ jobId: "a", requestId: "r1", title: "Verbale" }]
const TWO = [...ONE, { jobId: "b", requestId: "r2", title: "Contratto" }]

void test("a new agent has 2.5 s to say it is ready, a browser new to it 4 s, a browser known for an old one 6 s", () => {
  assert.equal(READY_MS, 2500)
  assert.equal(FIRST_READY_MS, 4000)
  assert.equal(OLD_AGENT_READY_MS, 6000)
  assert.equal(deadlineFor({ version: "0.4.0", at: "2026-10-21T10:00:00Z" }), 2500)
  // Possibly an old agent, which shows only once the backend served its job.
  assert.equal(deadlineFor(null), 4000)
  assert.equal(deadlineFor({ version: null, at: "2026-10-21T10:00:00Z" }), 6000)
})

void test("a browser that has run PoliNetwork eSign is offered Start, and a Start that didn't work says so", () => {
  const flag = { version: null, at: "2026-10-21T10:00:00Z" }
  assert.equal(notRunningVariant(flag, false), "start")
  assert.equal(notRunningVariant(null, false), "install")
  assert.equal(notRunningVariant(flag, true), "failed")
  assert.equal(notRunningVariant(null, true), "failed")
})

void test("the update is worded as the agent window words it, for packages on Linux", () => {
  assert.match(outdatedCopy("macos").body, /open PoliNetwork eSign inside: it replaces this one\.$/)
  assert.match(outdatedCopy("windows").body, /extract it and open esign\.exe: it replaces this one\.$/)
  assert.match(outdatedCopy("linux").body, /Update the polinetwork-esign package, or install the new one/)
  for (const os of ["macos", "windows", "linux"]) assert.equal(outdatedCopy(os).title, "Update PoliNetwork eSign")
})

void test("each fatal error of the agent window has its own state", () => {
  assert.equal(stateForFatal("agent_outdated"), "outdated")
  assert.equal(stateForFatal("backend_unreachable"), "connect")
  assert.equal(stateForFatal("job_expired"), "expired")
  for (const code of ["job_done", "job_cancelled", "job_failed", "signer_mismatch", "ticket_invalid", "internal", ""])
    assert.equal(stateForFatal(code), "continue", code)
})

void test("a failed job is worded by its code, never with where PIN or PUK digits come from", () => {
  const expected = {
    pin_locked: [
      "Your PIN is blocked",
      "Unblock it with your PUK in the CieID app on your phone or in CIE ID on this computer, then sign again.",
      null,
    ],
    middleware_missing: ["CIE ID isn't set up on this computer", "Follow the setup guide, then sign again.", "setup"],
    not_paired: ["Pair your CIE in CIE ID", "Open CIE ID and pair the card, then sign again.", "setup"],
    card_untrusted: ["This card can't be verified", "The PIN wasn't sent to it.", "setup"],
    card_unsupported: ["This card isn't supported", "Sign with your CIE.", null],
    signer_mismatch: ["This isn't your CIE", "Place your own CIE on the reader.", "again"],
    certificate_not_found: ["No signing certificate on this card", "The backend's words.", null],
    certificate_invalid: ["The card's certificate isn't valid", "The backend's words.", null],
    signature_invalid: ["The signature didn't verify", "Nothing was saved.", "again"],
    document_changed: ["The document changed", "Someone signed it in the meantime.", "again"],
    pdf_invalid: ["This PDF can't be signed", "The backend's words.", null],
    job_done: ["Nothing left to sign", "This request no longer needs your signature.", null],
  }
  assert.deepEqual([...TERMINAL_COPY.keys()].sort(), Object.keys(expected).sort())
  for (const [code, [title, body, extra]] of Object.entries(expected))
    assert.deepEqual(terminalCopy(code, "The backend's words."), { title, body, extra }, code)
  assert.deepEqual(terminalCopy("unheard_of", "Card error 6A82."), {
    title: "Signature failed",
    body: "Card error 6A82.",
    extra: null,
  })
  assert.equal(terminalCopy(null, null).body, "Nothing was signed.")
  // An error code is data from the network: an object's own keys never answer for it.
  assert.equal(terminalCopy("constructor", null).title, "Signature failed")
  for (const { body } of TERMINAL_COPY.values()) assert.doesNotMatch(body ?? "", /receipt|letter|Comune|digits/i)
})

void test("an attempt ends quietly only when the signer cancelled every job", () => {
  assert.equal(endingOf([job("a", "cancelled", "pin_incorrect", "Wrong PIN.")], ONE, false), null)
  const declined = endingOf(
    [job("a", "cancelled", "request_declined", "Mario Rossi declined this request: “Wrong date”.")],
    ONE,
    false
  )
  assert.equal(declined.reason, "declined")
  assert.equal(declined.title, "Request declined")
  assert.equal(declined.body, "Mario Rossi declined this request: “Wrong date”.")
  const failed = endingOf([job("a", "failed", "pin_locked", "PIN blocked")], ONE, false)
  assert.equal(failed.reason, "failed")
  assert.equal(failed.title, "Your PIN is blocked")
  // A code reserved for cancels and declines counts only on a cancelled job, as in the backend.
  assert.equal(endingOf([job("a", "failed", "request_cancelled", "Cancelled.")], ONE, false).reason, "failed")
})

void test("an attempt the backend ended is worded for the dashboard, not the agent window", () => {
  for (const [code, message] of [
    ["document_changed", "Someone else signed in the meantime. Start again from the dashboard."],
    ["job_done", "This request no longer needs your signature"],
  ]) {
    const failed = endingOf([job("a", "failed", code, message)], ONE, false)
    assert.notEqual(failed.body, message)
    assert.doesNotMatch(failed.body, /dashboard/)
  }
})

void test("an outdated agent ends in the update state, a timed-out window offers to sign again", () => {
  const outdated = endingOf([job("a", "failed", "agent_outdated", "Update PoliNetwork eSign.")], ONE, false)
  assert.equal(outdated.reason, "outdated")
  assert.equal(outdated.title, "Update PoliNetwork eSign")
  const expired = endingOf([job("a", "expired")], ONE, false)
  assert.equal(expired.title, "The signing window timed out")
  assert.equal(expired.body, "Nothing was signed.")
  assert.equal(expired.extra, "again")
  const composer = endingOf([job("a", "expired")], ONE, true)
  assert.match(composer.body, /Close to open the request and sign it from there\.$/)
  assert.equal(composer.extra, null)
})

void test("an ended batch names the document", () => {
  const cancelled = endingOf(
    [job("a", "cancelled"), job("b", "cancelled", "request_cancelled", "Anna Bianchi cancelled this request.")],
    TWO,
    false
  )
  assert.equal(cancelled.reason, "cancelled")
  assert.equal(cancelled.body, "Contratto: Anna Bianchi cancelled this request.")
  const failed = endingOf([job("a", "failed", "pdf_invalid", "Encrypted PDF."), job("b", "cancelled")], TWO, false)
  assert.equal(failed.body, "Verbale: Encrypted PDF.")
})

void test("signed, partly signed, ended and still open attempts are told apart", () => {
  assert.deepEqual(outcomeOf([job("a", "prepared"), job("b", "completed")], TWO, false), { kind: "open" })
  assert.deepEqual(outcomeOf([job("a", "completed"), job("b", "completed")], TWO, false), { kind: "signed" })
  assert.deepEqual(outcomeOf([job("a", "completed"), job("b", "failed", "pin_locked")], TWO, false), {
    kind: "partial",
    signed: 1,
  })
  assert.equal(outcomeOf([job("a", "failed", "pin_locked")], ONE, false).kind, "ended")
  assert.deepEqual(outcomeOf([job("a", "cancelled")], ONE, false), { kind: "dismissed" })
})

void test("a window the signer closed is read by where the signature stands", () => {
  // Before the agent answered: most likely the browser's "can't be reached" page.
  assert.equal(closedWindowAction(false, [job("a", "pending")]), "notRunning")
  // The card is working: its outcome is on its way.
  assert.equal(closedWindowAction(true, [job("a", "prepared"), job("b", "pending")]), "wait")
  assert.equal(closedWindowAction(true, [job("a", "completed"), job("b", "pending")]), "partial")
  assert.equal(closedWindowAction(true, [job("a", "pending")]), "dismiss")
})

void test("batch rows say why a document wasn't signed, and nothing while it still can be", () => {
  assert.equal(jobFailure(undefined), null)
  assert.equal(jobFailure(job("a", "pending", "pin_incorrect", "Wrong PIN.")), null)
  assert.equal(jobFailure(job("a", "completed")), null)
  assert.equal(jobFailure(job("a", "expired")), "The signing window timed out.")
  assert.equal(jobFailure(job("a", "cancelled")), "Not signed.")
  assert.equal(
    jobFailure(job("a", "cancelled", "request_declined", "Mario Rossi declined this request.")),
    "Mario Rossi declined this request."
  )
  assert.equal(
    jobFailure(job("a", "failed", "pin_locked")),
    "Your PIN is blocked. Unblock it with your PUK in the CieID app on your phone or in CIE ID on this computer, then sign again."
  )
})

void test("the update downloads the file for macOS and Windows and opens the release page on Linux", () => {
  assert.deepEqual(agentDownload("macos"), {
    href: AGENT_DOWNLOAD_URLS.macos,
    label: "Download for macOS",
    direct: true,
  })
  assert.match(agentDownload("macos").href, /PoliNetwork-eSign-macos\.dmg$/)
  assert.deepEqual(agentDownload("windows"), {
    href: AGENT_DOWNLOAD_URLS.windows,
    label: "Download for Windows",
    direct: true,
  })
  assert.match(agentDownload("windows").href, /PoliNetwork-eSign-windows-amd64\.zip$/)
  assert.deepEqual(agentDownload("linux"), { href: AGENT_RELEASES_URL, label: "Open the download page", direct: false })
})
