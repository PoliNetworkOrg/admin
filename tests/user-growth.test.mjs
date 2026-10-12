import assert from "node:assert/strict"
import test from "node:test"

import { growthSeries, parseDay } from "../src/features/dashboard/user-growth.ts"

const days = [
  { date: "2025-01-15", count: 10 },
  { date: "2025-10-11", count: 4 },
  { date: "2025-10-12", count: 1 },
  { date: "2026-07-11", count: 7 },
  { date: "2026-07-12", count: 5 },
  { date: "2026-09-20", count: 3 },
  { date: "2026-10-10", count: 2 },
]
const total = days.reduce((sum, day) => sum + day.count, 0)

test("3M plots one cumulative point per day and counts exactly the last 3 months", () => {
  const series = growthSeries(days, "2026-10-11", "3m")
  assert.equal(series.points[0].time, parseDay("2026-07-12"))
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.equal(series.points.length, 92)
  assert.equal(series.points.at(-1).total, total)
  // After 11 Jul through today: 12 Jul, 20 Sep and 10 Oct; 11 Jul itself is three months ago, outside the range.
  assert.equal(series.added, 5 + 3 + 2)
  const spike = series.points.find((point) => point.time === parseDay("2026-09-20"))
  assert.deepEqual([spike.added, spike.label], [3, "20 Sep 2026"])
  assert.deepEqual(series.ticks.map(series.tickLabel), ["Aug", "Sep", "Oct"])
})

test("1Y plots weekly points ending today and counts exactly the last 12 months", () => {
  const series = growthSeries(days, "2026-10-11", "1y")
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.ok(
    series.points.every((point, index) => index === 0 || point.time - series.points[index - 1].time === 7 * 86_400_000)
  )
  assert.ok(series.points[0].time > parseDay("2025-10-11"))
  // 12 Oct 2025 is in, 11 Oct 2025 (exactly a year ago) is not.
  assert.equal(series.added, 1 + 7 + 5 + 3 + 2)
  assert.equal(series.points.at(-1).label, "5 Oct → 11 Oct 2026")
  assert.ok(series.ticks.map(series.tickLabel).includes("Jan 2026"))
})

test("All plots one point per month from the first user and names the year on January", () => {
  const series = growthSeries(days, "2026-10-11", "all")
  assert.equal(series.points[0].label, "January 2025")
  assert.equal(series.points[0].total, 10)
  assert.equal(series.points.at(-1).label, "October 2026")
  assert.equal(series.points.length, 22)
  assert.equal(series.added, total)
  const labels = series.ticks.map(series.tickLabel)
  assert.deepEqual(labels.slice(0, 2), ["Feb", "Mar"])
  assert.ok(labels.includes("Jan 2026"))
  assert.ok(!labels.includes("Jan"))
})

test("spans over two years label years", () => {
  const series = growthSeries([{ date: "2022-03-01", count: 1 }], "2026-10-11", "all")
  assert.deepEqual(series.ticks.map(series.tickLabel), ["2023", "2024", "2025", "2026"])
})

test("month arithmetic clamps to the target month's last day", () => {
  const series = growthSeries([], "2026-12-31", "3m")
  assert.equal(series.points[0].time, parseDay("2026-10-01"))
})

test("no users yet gives an empty all-time series", () => {
  const series = growthSeries([], "2026-10-11", "all")
  assert.equal(series.added, 0)
  assert.ok(series.points.every((point) => point.total === 0))
})
