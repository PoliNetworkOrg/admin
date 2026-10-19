import assert from "node:assert/strict"
import test from "node:test"

import { growthAxis, growthSeries, parseDay } from "../src/features/dashboard/user-growth.ts"

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

void test("3M plots one cumulative point per day and counts exactly the last 3 months", () => {
  const series = growthSeries(days, "2026-10-11", "3m")
  assert.equal(series.points[0].time, parseDay("2026-07-12"))
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.equal(series.points.length, 92)
  assert.equal(series.points.at(-1).total, total)
  // After 11 Jul through today: 12 Jul, 20 Sep and 10 Oct; 11 Jul itself is three months ago, outside the range.
  assert.equal(series.added, 5 + 3 + 2)
  assert.equal(
    series.points.reduce((sum, point) => sum + point.added, 0),
    series.added
  )
  const spike = series.points.find((point) => point.time === parseDay("2026-09-20"))
  assert.deepEqual([spike.added, spike.label], [3, "20 Sep 2026"])
  assert.deepEqual(series.ticks.map(series.tickLabel), ["Aug", "Sep", "Oct"])
})

void test("1Y plots weekly points ending today and counts exactly the last 12 months", () => {
  const series = growthSeries(days, "2026-10-11", "1y")
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.ok(
    series.points.every((point, index) => index === 0 || point.time - series.points[index - 1].time === 7 * 86_400_000)
  )
  assert.ok(series.points[0].time > parseDay("2025-10-11"))
  // 12 Oct 2025 is in, 11 Oct 2025 (exactly a year ago) is not.
  assert.equal(series.added, 1 + 7 + 5 + 3 + 2)
  assert.equal(series.points.at(-1).label, "5 Oct → 11 Oct 2026")
  // The first week is cut at the range start: it counts 12 Oct 2025 only, not 11 Oct (a year ago) or earlier.
  assert.equal(series.points[0].time, parseDay("2025-10-12"))
  assert.deepEqual([series.points[0].added, series.points[0].label], [1, "12 Oct 2025"])
  assert.equal(
    series.points.reduce((sum, point) => sum + point.added, 0),
    series.added
  )
  assert.ok(series.ticks.map(series.tickLabel).includes("Jan 2026"))
})

void test("All plots one point per month from the first user and names the year on January", () => {
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

void test("spans over two years label years", () => {
  const series = growthSeries([{ date: "2022-03-01", count: 1 }], "2026-10-11", "all")
  assert.deepEqual(series.ticks.map(series.tickLabel), ["2023", "2024", "2025", "2026"])
})

void test("month arithmetic clamps to the target month's last day", () => {
  const series = growthSeries([], "2026-12-31", "3m")
  assert.equal(series.points[0].time, parseDay("2026-10-01"))
})

void test("no users yet gives an empty all-time series", () => {
  const series = growthSeries([], "2026-10-11", "all")
  assert.equal(series.added, 0)
  assert.ok(series.points.every((point) => point.total === 0))
})

void test("y axis labels stay distinct on narrow ranges", () => {
  const cases = [
    [{ total: 13_300 }, { total: 13_380 }],
    [{ total: 1_180 }, { total: 1_420 }],
    [{ total: 250_100 }, { total: 250_400 }],
    [{ total: 1_240_000 }, { total: 1_310_000 }],
    [{ total: 7 }, { total: 7 }],
    [],
  ]
  for (const points of cases) {
    const axis = growthAxis(points)
    const labels = axis.values.map(axis.format)
    assert.equal(new Set(labels).size, labels.length, labels.join(", "))
    assert.ok(axis.values.length >= 2)
    assert.ok(points.every(({ total }) => total >= axis.domain[0] && total <= axis.domain[1]))
  }
  const narrow = growthAxis([{ total: 13_300 }, { total: 13_380 }])
  assert.deepEqual(narrow.values.map(narrow.format), ["13,300", "13,320", "13,340", "13,360", "13,380"])
  const large = growthAxis([{ total: 1_240_000 }, { total: 1_310_000 }])
  assert.deepEqual(large.values.map(large.format), ["1.24m", "1.26m", "1.28m", "1.3m", "1.32m"])
})
