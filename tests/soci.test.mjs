import assert from "node:assert/strict"
import { test } from "node:test"

import { checkCharacter, codiceFiscaleProblem, matchesBirthDate } from "../src/features/soci/codice-fiscale.ts"
import { isMemberNumber } from "../src/features/soci/member-number.ts"
import {
  admitInputSchema,
  codiceFiscaleSchema,
  registerInputSchema,
  updateInputSchema,
} from "../src/features/soci/soci.contract.ts"

const details = {
  firstName: "Mario",
  lastName: "Rossi",
  alias: "",
  codiceFiscale: "rssmra80a01h501u",
  birthDate: "1980-01-01",
  birthPlace: "Roma",
  residence: { street: "Via Roma 1", postalCode: "20133", city: "Milano", province: "mi", country: "it" },
}
const admission = {
  account: { firstName: "Mario", lastName: "Rossi", mailbox: { kind: "standard" }, sendEmailTo: "mario@example.org" },
  number: 344,
  details,
  admittedOn: "2026-11-09",
}

void test("member numbers are positive integers up to the backend's six digits", () => {
  for (const valid of ["1", "344", "999999"]) assert.equal(isMemberNumber(valid), true, valid)
  for (const invalid of ["", "0", "0344", "-1", "1.2", "1000000"]) assert.equal(isMemberNumber(invalid), false, invalid)
})

void test("the codice fiscale is checked like the backend: format, omocodia, check character, birth date", () => {
  assert.equal(codiceFiscaleProblem("RSSMRA80A01H501U"), null)
  const omocodic = `RSSMRA80A01H50M${checkCharacter("RSSMRA80A01H50M")}`
  assert.equal(codiceFiscaleProblem(omocodic), null)
  assert.equal(matchesBirthDate(omocodic, "1980-01-01"), true)
  assert.equal(codiceFiscaleProblem("RSSMRA80A01H501X"), "check")
  assert.equal(codiceFiscaleProblem("RSSMRA80A01H501"), "format")
  assert.equal(codiceFiscaleSchema.parse(" rssmra80a01 h501u "), "RSSMRA80A01H501U")
})

void test("admitting needs every detail but the alias, normalized as the backend stores it", () => {
  const parsed = admitInputSchema.parse(admission)
  assert.equal(parsed.details.codiceFiscale, "RSSMRA80A01H501U")
  assert.deepEqual(parsed.details.residence, {
    street: "Via Roma 1",
    postalCode: "20133",
    city: "Milano",
    province: "MI",
    country: "IT",
  })
  assert.equal(parsed.details.alias, null)
  for (const missing of ["birthPlace", "codiceFiscale", "birthDate"])
    assert.equal(admitInputSchema.safeParse({ ...admission, details: { ...details, [missing]: "" } }).success, false)
  const noProvince = { ...details, residence: { ...details.residence, province: "" } }
  assert.equal(admitInputSchema.safeParse({ ...admission, details: noProvince }).success, false)
  const wrongDate = { ...details, birthDate: "1980-01-02" }
  assert.equal(admitInputSchema.safeParse({ ...admission, details: wrongDate }).success, false)
})

void test("registering and editing need only the legal name", () => {
  const minimal = { firstName: "Alan", lastName: "Turing" }
  const registered = registerInputSchema.parse({
    entraObjectId: "acc-alan",
    details: minimal,
    admittedOn: "2025-03-14",
  })
  assert.equal(registered.details.codiceFiscale, null)
  assert.equal(registered.details.residence.street, null)
  const empty = {
    ...minimal,
    codiceFiscale: "",
    birthDate: "",
    birthPlace: "",
    residence: { street: "", postalCode: "", city: "", province: "", country: "" },
  }
  assert.equal(updateInputSchema.safeParse({ number: 41, details: empty, admittedOn: "2025-10-13" }).success, true)
  assert.equal(
    updateInputSchema.safeParse({ number: 41, details: { lastName: "Gallo" }, admittedOn: "2025-10-13" }).success,
    false
  )
})

void test("an account name the backend refuses is reported on the account's field, not the legal name", () => {
  const parsed = admitInputSchema.safeParse({ ...admission, account: { ...admission.account, lastName: "O’Brien" } })
  assert.equal(parsed.success, false)
  // `fieldErrors` in socio-form.tsx shows this path on the account's Last name field.
  assert.deepEqual(
    parsed.error.issues.map((issue) => issue.path.join(".")),
    ["account.lastName"]
  )
})

void test("an email the contract refuses is reported on the welcome email field", () => {
  const parsed = admitInputSchema.safeParse({ ...admission, account: { ...admission.account, sendEmailTo: "a@b.c" } })
  assert.equal(parsed.success, false)
  // `fieldErrors` maps this path to `accountEmail`, which the Admit dialog shows on the email field.
  assert.deepEqual(
    parsed.error.issues.map((issue) => issue.path.join(".")),
    ["account.sendEmailTo"]
  )
})
