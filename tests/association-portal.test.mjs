import assert from "node:assert/strict"
import test from "node:test"

import {
  applicantActions,
  isApplicantAction,
  isOperatorAction,
  logoFormSchema,
  operatorActions,
} from "../src/features/association-portal/portal.contract.ts"

void test("operator and applicant actions never overlap", () => {
  for (const action of operatorActions) {
    assert.equal(isOperatorAction(action), true)
    assert.equal(isApplicantAction(action), false)
  }
  for (const action of applicantActions) assert.equal(isApplicantAction(action), true)
  assert.equal(isApplicantAction("something-new"), false)
})

void test("logo uploads are PNG or JPEG of at most 1 MiB for a known association", () => {
  const form = (file, id = "00000000-0000-4000-8000-000000000001") => {
    const data = new FormData()
    data.set("id", id)
    if (file) data.set("file", file)
    return data
  }
  const png = new File([new Uint8Array(8)], "logo.png", { type: "image/png" })
  assert.equal(logoFormSchema.safeParse(form(png)).success, true)
  assert.equal(logoFormSchema.safeParse(form(new File(["<svg/>"], "l.svg", { type: "image/svg+xml" }))).success, false)
  assert.equal(
    logoFormSchema.safeParse(form(new File([new Uint8Array(1024 * 1024 + 1)], "l.png", { type: "image/png" }))).success,
    false
  )
  assert.equal(logoFormSchema.safeParse(form(png, "nope")).success, false)
  assert.equal(logoFormSchema.safeParse(form(null)).success, false)
})
