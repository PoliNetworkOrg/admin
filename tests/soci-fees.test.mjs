import assert from "node:assert/strict"
import { test } from "node:test"

import {
  feeYearLabel,
  feeYearOf,
  feeYearsSince,
  parseEuro,
  pastDeadline,
  renewalDeadline,
} from "../src/features/soci/soci-fees.ts"
import {
  completeDetailsInputSchema,
  markPaidInputSchema,
  receiptInputSchema,
} from "../src/features/soci/soci.contract.ts"

void test("a fee year runs from 1 September to 31 August and is renewed by 31 December", () => {
  assert.equal(feeYearOf("2026-08-31"), 2025)
  assert.equal(feeYearOf("2026-09-01"), 2026)
  assert.equal(feeYearOf("2027-02-10"), 2026)
  assert.equal(feeYearLabel(2026), "2026/27")
  assert.equal(feeYearLabel(2099), "2099/00")
  assert.equal(renewalDeadline(2026), "2026-12-31")
  assert.equal(pastDeadline(2026, "2026-12-31"), false)
  assert.equal(pastDeadline(2026, "2027-01-01"), true)
})

void test("the fee-year menu goes from this year back to the oldest admission's", () => {
  assert.deepEqual(feeYearsSince("2024-10-07", "2026-11-14"), [2026, 2025, 2024])
  assert.deepEqual(feeYearsSince("2024-07-01", "2026-11-14"), [2026, 2025, 2024, 2023])
  assert.deepEqual(feeYearsSince(null, "2026-11-14"), [2026])
})

void test("the declared amount accepts the ways people write euros, in cents", () => {
  assert.equal(parseEuro("5"), 500)
  assert.equal(parseEuro("5,00"), 500)
  assert.equal(parseEuro("€ 5.5"), 550)
  assert.equal(parseEuro("0"), null)
  assert.equal(parseEuro("5.001"), null)
  assert.equal(parseEuro("five"), null)
})

void test("fee inputs follow the backend's contract", () => {
  assert.equal(receiptInputSchema.parse({ transferDate: "2026-11-02", declaredCents: "500" }).declaredCents, 500)
  assert.throws(() => receiptInputSchema.parse({ transferDate: "2026-11-02", declaredCents: "0" }))
  const paid = markPaidInputSchema.parse({ number: 7, year: 2026, paidOn: "2026-11-02", method: "other", note: "" })
  assert.equal(paid.note, null)
  assert.throws(() => markPaidInputSchema.parse({ number: 7, year: 2026, paidOn: "2026-11-02", method: "admission" }))
  // Completing details: empty fields mean "not given", and at least one is needed.
  assert.deepEqual(completeDetailsInputSchema.parse({ birthPlace: "Milano", residence: "" }), {
    codiceFiscale: null,
    birthDate: null,
    birthPlace: "Milano",
    residence: null,
    phone: null,
  })
  assert.throws(() => completeDetailsInputSchema.parse({ residence: "" }))
})
