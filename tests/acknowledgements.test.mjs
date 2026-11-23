import assert from "node:assert/strict"
import test from "node:test"

import {
  acknowledgementGroupInput,
  acknowledgementInput,
  acknowledgementsErrorMessage,
  reorderAcknowledgementsInput,
  updateAcknowledgementInput,
} from "../src/features/acknowledgements/acknowledgements.validation.ts"

void test("acknowledgement groups need a title and one of the backend's icons", () => {
  assert.deepEqual(acknowledgementGroupInput.parse({ title: "  Designer ", icon: "palette" }), {
    title: "Designer",
    icon: "palette",
  })
  for (const input of [
    { title: " ", icon: "palette" },
    { title: "x".repeat(81), icon: "palette" },
    { title: "Designer", icon: "rocket" },
    { title: "Designer", icon: "palette", position: 1 },
  ])
    assert.equal(acknowledgementGroupInput.safeParse(input).success, false, JSON.stringify(input))
})

void test("people go in a website group or the projects list, with an optional detail", () => {
  const website = { section: "website", groupId: 3 }
  assert.deepEqual(acknowledgementInput.parse({ list: website, name: " Mario Rossi ", detail: " Backend " }), {
    list: website,
    name: "Mario Rossi",
    detail: "Backend",
  })
  assert.equal(acknowledgementInput.parse({ list: { section: "projects" }, name: "Mario", detail: "" }).detail, "")
  for (const input of [
    { list: { section: "website" }, name: "Mario", detail: "" },
    { list: { section: "projects", groupId: 3 }, name: "Mario", detail: "" },
    { list: { section: "other" }, name: "Mario", detail: "" },
    { list: website, name: " ", detail: "" },
    { list: website, name: "x".repeat(121), detail: "" },
    { list: website, name: "Mario", detail: "x".repeat(81) },
  ])
    assert.equal(acknowledgementInput.safeParse(input).success, false, JSON.stringify(input))
  assert.equal(updateAcknowledgementInput.safeParse({ id: 2, name: "Mario", detail: "" }).success, true)
  assert.equal(updateAcknowledgementInput.safeParse({ name: "Mario", detail: "" }).success, false)
})

void test("acknowledgement reorders need unique ids", () => {
  const list = { section: "projects" }
  assert.equal(reorderAcknowledgementsInput.safeParse({ list, ids: [3, 1, 2] }).success, true)
  assert.equal(reorderAcknowledgementsInput.safeParse({ list, ids: [] }).success, false)
  assert.equal(reorderAcknowledgementsInput.safeParse({ list, ids: [1, 1] }).success, false)
})

void test("acknowledgement errors read in Italian", () => {
  for (const [code, expected] of [
    ["GROUP_NOT_FOUND", /gruppo non esiste più/],
    ["NOT_FOUND", /non esiste più/i],
    ["INVALID_ORDER", /elenco è cambiato/],
  ])
    assert.match(acknowledgementsErrorMessage(new Error(code), "fallback"), expected, code)
  assert.equal(acknowledgementsErrorMessage(new Error("boom"), "fallback"), "fallback")
})
