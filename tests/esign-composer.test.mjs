import assert from "node:assert/strict"
import test from "node:test"

import {
  composerPrimary,
  declinedLine,
  invalidRecipient,
  parseRecipients,
  prefillDraft,
  savedToText,
  signsFirst,
} from "../src/features/esign/composer.ts"

void test("the creator alone signs with CIE in the click that creates the request", () => {
  assert.equal(composerPrimary(["me"], "me", true, true), "sign")
  assert.equal(composerPrimary(["me"], "me", false, true), "sign")
})

void test("a creator who signs first signs and sends; anyone else's first turn only sends", () => {
  assert.equal(composerPrimary(["me", "mario"], "me", true, true), "signAndSend")
  assert.equal(composerPrimary(["mario", "me"], "me", true, true), "send")
  // Without an order everyone's turn starts at once, the creator's too.
  assert.equal(composerPrimary(["mario", "me"], "me", false, true), "signAndSend")
  assert.equal(composerPrimary(["mario", "anna"], "me", false, true), "send")
  assert.equal(composerPrimary([], "me", true, true), "send")
})

void test("an empty spot counts as the signer it will hold, in its place", () => {
  assert.equal(composerPrimary(["me", ""], "me", true, true), "signAndSend")
  assert.equal(composerPrimary(["", "me"], "me", true, true), "send")
})

void test("phones and tablets only send, even on the creator's own turn", () => {
  assert.equal(composerPrimary(["me"], "me", true, false), "send")
  assert.equal(composerPrimary(["me", "mario"], "me", true, false), "send")
  assert.equal(signsFirst(["me", "mario"], "me", true), true)
})

void test("the save summary uses the request page's words and the full path", () => {
  assert.equal(
    savedToText("OneDrive (development copy)", "Verbali/2026", "Verbale - firmato.pdf"),
    "Will be saved to OneDrive (development copy): Verbali/2026/Verbale - firmato.pdf"
  )
  assert.equal(
    savedToText("OneDrive", "", "Contratto - firmato.pdf"),
    "Will be saved to OneDrive: /Contratto - firmato.pdf"
  )
})

void test("recipients split on commas, semicolons and spaces, and the first bad one is named", () => {
  const recipients = parseRecipients(" segreteria@polinetwork.org, mario@example.com;anna@example.com  ")
  assert.deepEqual(recipients, ["segreteria@polinetwork.org", "mario@example.com", "anna@example.com"])
  assert.equal(invalidRecipient(recipients), undefined)
  assert.equal(invalidRecipient(parseRecipients("mario@example.com, foo")), "foo")
  assert.deepEqual(parseRecipients(""), [])
})

const place = { page: 0, x: 0.1, y: 0.8, width: 0.3, height: 0.07, kind: "signature" }
const signer = (position, sub, name, role, extra = {}) => ({
  position,
  sub,
  name,
  role,
  places: [{ ...place, x: 0.1 + position * 0.4 }],
  status: "pending",
  declineReason: null,
  ...extra,
})
const declined = {
  title: "Verbale Consiglio Direttivo 2026-10-10",
  status: "declined",
  ordered: true,
  // Listed out of order: the prefill follows `position`.
  signers: [
    signer(1, "mario", "Mario Rossi", "Presidente", { status: "declined", declineReason: " Wrong date. " }),
    signer(0, "me", "Anna Bianchi", null, { status: "signed" }),
  ],
  output: { driveId: "dev", folderId: "f1", folderPath: "Verbali/2026", fileName: "Verbale - firmato.pdf" },
  email: { to: ["segreteria@example.org", "mario@example.com"], message: "In allegato." },
}

void test("a request sent again copies the title, the signers in order with roles and places, and the delivery", () => {
  const draft = prefillDraft(declined, ["dev"])
  assert.equal(draft.title, "Verbale Consiglio Direttivo 2026-10-10")
  assert.equal(draft.ordered, true)
  assert.deepEqual(
    draft.rows.map((r) => [r.id, r.person.name, r.role, r.spot, r.places[0].x]),
    [
      ["person:me", "Anna Bianchi", "", null, 0.1],
      ["person:mario", "Mario Rossi", "Presidente", null, 0.5],
    ]
  )
  assert.deepEqual(draft.rows[0].places[0], { ...place, x: 0.1 })
  assert.equal(draft.saveToDrive, true)
  assert.deepEqual(draft.folder, { driveId: "dev", id: "f1", path: "Verbali/2026" })
  assert.equal(draft.fileName, "Verbale - firmato.pdf")
  assert.equal(draft.emails, "segreteria@example.org, mario@example.com")
  assert.equal(draft.message, "In allegato.")
})

void test("a request kept in the dashboard stays so, and a folder on a drive gone is asked again", () => {
  const kept = prefillDraft({ ...declined, output: null, email: null }, ["dev"])
  assert.equal(kept.saveToDrive, false)
  assert.equal(kept.folder, null)
  assert.equal(kept.emails, "")
  assert.equal(kept.message, "")
  const driveGone = prefillDraft(declined, ["other"])
  assert.equal(driveGone.saveToDrive, true)
  assert.equal(driveGone.folder, null)
  assert.equal(driveGone.fileName, "Verbale - firmato.pdf")
  assert.equal(prefillDraft(declined, []).saveToDrive, false, "no drives configured at all")
})

void test("a declined request names who declined and why; other requests have no line", () => {
  assert.equal(declinedLine(declined), "Mario Rossi declined: “Wrong date.”")
  const noReason = declined.signers.map((s) => ({ ...s, declineReason: null }))
  assert.equal(declinedLine({ status: "declined", signers: noReason }), "Mario Rossi declined.")
  assert.equal(declinedLine({ ...declined, status: "cancelled" }), null)
})
