import assert from "node:assert/strict"
import { test } from "node:test"

import { birthDateFor, birthDateOf } from "../src/features/soci/codice-fiscale-birth.ts"
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
  residence: " Via Roma 1, 20133 Milano (MI) ",
  phone: "",
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

void test("a valid codice fiscale gives the birth date, in the latest century not after today", () => {
  const today = "2026-11-12"
  const code = (first15) => `${first15}${checkCharacter(first15)}`
  assert.equal(birthDateOf("rssmra80a01h501u", today), "1980-01-01")
  assert.equal(birthDateOf(code("RSSMRA05M41F205"), today), "2005-08-01")
  assert.equal(birthDateOf(code("RSSMRA26S30F205"), today), "1926-11-30")
  assert.equal(birthDateOf(code("RSSMRA26S12F205"), today), "2026-11-12")
  // 29 February 2001 doesn't exist, 1901 neither; 2000 does.
  assert.equal(birthDateOf(code("RSSMRA01B29F205"), today), null)
  assert.equal(birthDateOf(code("RSSMRA00B69F205"), today), "2000-02-29")
  assert.equal(birthDateOf(code("RSSMRA80A01H50M"), today), "1980-01-01")
  for (const invalid of ["", "RSSMRA80A01H501", "RSSMRA80A01H501X"]) assert.equal(birthDateOf(invalid, today), null)

  assert.equal(birthDateFor("RSSMRA80A01H501", "", today), "", "an incomplete code leaves the date")
  assert.equal(birthDateFor("RSSMRA80A01H501U", "", today), "1980-01-01")
  assert.equal(birthDateFor("RSSMRA80A01H501U", "1999-05-05", today), "1980-01-01", "a wrong date is replaced")
  assert.equal(birthDateFor("RSSMRA80A01H501U", "1880-01-01", today), "1880-01-01", "a matching date is kept")
})

void test("admitting needs every detail but the alias and the phone, normalized as the backend stores it", () => {
  const parsed = admitInputSchema.parse(admission)
  assert.equal(parsed.details.codiceFiscale, "RSSMRA80A01H501U")
  assert.equal(parsed.details.residence, "Via Roma 1, 20133 Milano (MI)")
  assert.equal(parsed.details.alias, null)
  assert.equal(parsed.details.phone, null)
  for (const missing of ["birthPlace", "codiceFiscale", "birthDate", "residence"])
    assert.equal(admitInputSchema.safeParse({ ...admission, details: { ...details, [missing]: "" } }).success, false)
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
  assert.equal(registered.details.residence, null)
  assert.equal(registered.details.phone, null)
  const empty = {
    ...minimal,
    codiceFiscale: "",
    birthDate: "",
    birthPlace: "",
    residence: "",
    phone: "",
  }
  assert.equal(updateInputSchema.safeParse({ number: 41, details: empty, admittedOn: "2025-10-13" }).success, true)
  assert.equal(
    updateInputSchema.safeParse({ number: 41, details: { lastName: "Gallo" }, admittedOn: "2025-10-13" }).success,
    false
  )
})

void test("the phone is optional, in international format, without spaces or separators", () => {
  const withPhone = (phone) => admitInputSchema.safeParse({ ...admission, details: { ...details, phone } })
  assert.equal(withPhone("+39 333 123 4567").data?.details.phone, "+393331234567")
  assert.equal(withPhone("+44 (20) 7946-0958").data?.details.phone, "+442079460958")
  for (const invalid of ["333 123 4567", "0039 333 123 4567", "+39 333", "+39 333 abc 4567"]) {
    const parsed = withPhone(invalid)
    assert.equal(parsed.success, false, invalid)
    // `fieldErrors` in socio-form.tsx shows this path on the Phone field.
    assert.deepEqual(
      parsed.error.issues.map((issue) => issue.path.join(".")),
      ["details.phone"]
    )
  }
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
