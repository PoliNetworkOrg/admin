import assert from "node:assert/strict"
import test from "node:test"

import { formatDate, formatDateTime, formatRange } from "../src/lib/format.ts"

test("dashboard timestamps remain identical across server and browser timezones", () => {
  const originalTimezone = process.env.TZ
  try {
    for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timezone
      assert.equal(formatDateTime(new Date("2026-01-15T23:30:00Z")), "16 Jan 2026, 00:30")
      assert.equal(formatDateTime(new Date("2026-07-15T23:30:00Z")), "16 Jul 2026, 01:30")
      assert.equal(formatDate(new Date("2026-07-15T23:30:00Z")), "16 Jul 2026")
    }
    assert.equal(
      formatRange(new Date("2026-01-15T23:30:00Z"), new Date("2026-07-15T23:30:00Z")),
      "16 Jan 2026, 00:30 → 16 Jul 2026, 01:30"
    )
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }
})
