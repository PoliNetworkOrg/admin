import assert from "node:assert/strict"
import test from "node:test"

import { portalErrorMessage } from "../src/features/association-portal/portal-errors.ts"
import { eventLabel } from "../src/features/association-portal/portal-events.ts"
import {
  applicantActions,
  contactSchema,
  directorySchema,
  eventApplicantActions,
  eventOperatorActions,
  isEventOperatorAction,
  isPromotionOperatorAction,
  posterFormSchema,
  promotionApplicantActions,
  promotionOperatorActions,
  profileSchema,
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

void test("contacts are an applicant action, saved by representatives without review rights", () => {
  assert.equal(isApplicantAction("contacts"), true)
  assert.equal(isOperatorAction("contacts"), false)
})

void test("contacts keep personal fields optional and refuse malformed phone numbers", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000001",
    function: "events",
    label: "Eventi",
    email: "eventi@example.org",
    visibility: "associations",
  }
  assert.deepEqual(contactSchema.parse(base).name, "")
  assert.equal(contactSchema.safeParse({ ...base, phone: "+39 333 123 4567" }).success, true)
  assert.equal(contactSchema.safeParse({ ...base, phone: "call me" }).success, false)
  assert.equal(contactSchema.safeParse({ ...base, visibility: "everyone" }).success, false)
})

void test("responses from a backend without programmes, campuses or contacts still parse", () => {
  const legacy = { name: "A", acronym: "", descriptionIt: "", descriptionEn: "", logo: null, email: "", links: [] }
  assert.deepEqual(profileSchema.parse(legacy), {
    ...legacy,
    programmes: [],
    campuses: [],
    crossProgramme: false,
    contacts: [],
  })
  assert.deepEqual(
    directorySchema.parse([{ id: "00000000-0000-4000-8000-000000000001", name: "A", revision: 1 }])[0].contacts,
    []
  )
})

void test("promotion decisions are operator actions, drafting and submitting are not", () => {
  for (const action of promotionOperatorActions) assert.equal(isPromotionOperatorAction(action), true)
  for (const action of promotionApplicantActions) assert.equal(isPromotionOperatorAction(action), false)
})

void test("event decisions are operator actions, drafting and submitting are not", () => {
  for (const action of eventOperatorActions) assert.equal(isEventOperatorAction(action), true)
  for (const action of eventApplicantActions) assert.equal(isEventOperatorAction(action), false)
  assert.equal(isApplicantAction("collaboration"), true)
})

void test("posters are PNG or JPEG of at most 5 MiB", () => {
  const form = (file) => {
    const data = new FormData()
    data.set("id", "00000000-0000-4000-8000-000000000001")
    data.set("file", file)
    return data
  }
  assert.equal(
    posterFormSchema.safeParse(form(new File([new Uint8Array(8)], "p.jpg", { type: "image/jpeg" }))).success,
    true
  )
  assert.equal(
    posterFormSchema.safeParse(form(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "p.png", { type: "image/png" })))
      .success,
    false
  )
})

void test("backend errors are shown in Italian, unknown ones as sent", () => {
  assert.equal(portalErrorMessage("Choose the desired date"), "Scegli la data desiderata.")
  assert.equal(portalErrorMessage("Something new"), "Something new")
})

void test("history events are shown in Italian, unknown ones as recorded", () => {
  assert.equal(eventLabel("Draft saved"), "Bozza salvata")
  assert.equal(eventLabel("Request approved"), "Richiesta approvata")
  assert.equal(eventLabel("Association suspended"), "Associazione sospesa")
  assert.equal(eventLabel("Contacts updated"), "Contatti aggiornati")
  assert.equal(eventLabel("Something new"), "Something new")
})
