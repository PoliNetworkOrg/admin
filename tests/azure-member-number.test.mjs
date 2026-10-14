import assert from "node:assert/strict"
import { test } from "node:test"

import { isMemberNumber, reconcileMemberNumbers } from "../src/features/azure/member-number.ts"

void test("a stale directory refresh keeps the saved member number", () => {
  const saved = new Map([["alan", "2042"]])
  const stale = [{ id: "alan", employeeId: "1002" }]

  assert.equal(reconcileMemberNumbers(saved, stale).get("alan"), "2042")
  assert.equal(reconcileMemberNumbers(saved, null).get("alan"), "2042")
})

void test("a confirmed member number stops masking subsequent directory changes", () => {
  const saved = new Map([
    ["alan", "2042"],
    ["grace", "2043"],
  ])
  const refreshed = [
    { id: "alan", employeeId: "2042" },
    { id: "grace", employeeId: null },
  ]

  const remaining = reconcileMemberNumbers(saved, refreshed)
  assert.equal(remaining.has("alan"), false)
  assert.equal(remaining.get("grace"), "2043")
  assert.equal(saved.get("alan"), "2042")
  const externalEdit = [{ id: "alan", employeeId: "2044" }]
  assert.equal(remaining.get("alan") ?? externalEdit[0].employeeId, "2044")
})

void test("member numbers must be positive integers the API can represent exactly", () => {
  for (const valid of ["1", "2042", "9007199254740991"]) assert.equal(isMemberNumber(valid), true)
  for (const invalid of ["", "0", "01", "-1", "1.2", "9007199254740992", "999999999999999999999"])
    assert.equal(isMemberNumber(invalid), false)
})
