import assert from "node:assert/strict"
import test from "node:test"

import { academicYear, dateOnlyValue, parseDateOnly } from "../src/lib/date-only.ts"

void test("calendar dates reject impossible days and retain the selected day across time zones", () => {
  const original = process.env.TZ
  try {
    for (const timezone of ["UTC", "Europe/Rome", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = timezone
      assert.equal(dateOnlyValue(parseDateOnly("2028-02-29")), "2028-02-29")
      assert.equal(dateOnlyValue(parseDateOnly("2026-10-25")), "2026-10-25")
      for (const invalid of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-01-00", "10/14/2026", ""]) {
        assert.equal(parseDateOnly(invalid), undefined)
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

void test("academic years start on 1 September", () => {
  assert.equal(academicYear("2026-08-31"), "2025/26")
  assert.equal(academicYear("2026-09-01"), "2026/27")
  assert.equal(academicYear("2026-12-31"), "2026/27")
  assert.equal(academicYear("2027-01-01"), "2026/27")
  assert.equal(academicYear("2099-10-01"), "2099/00")
})
