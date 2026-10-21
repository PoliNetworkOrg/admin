import assert from "node:assert/strict"
import test from "node:test"

import {
  composerPrimary,
  invalidRecipient,
  parseRecipients,
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
