import assert from "node:assert/strict"
import test from "node:test"

import { growthSeries, parseDay } from "../src/features/dashboard/user-growth.ts"

const days = [
  { date: "2025-01-15", count: 10 },
  { date: "2026-07-01", count: 5 },
  { date: "2026-09-20", count: 3 },
  { date: "2026-10-10", count: 2 },
]

test("3M plots one cumulative point per day and counts the range's growth", () => {
  const series = growthSeries(days, "2026-10-11", "3m")
  assert.equal(series.points[0].time, parseDay("2026-07-11"))
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.equal(series.points.length, 93)
  assert.equal(series.points[0].total, 15)
  assert.equal(series.points.at(-1).total, 20)
  assert.equal(series.added, 5)
  const spike = series.points.find((point) => point.time === parseDay("2026-09-20"))
  assert.deepEqual([spike.total, spike.added, spike.label], [18, 3, "20 Sept 2026"])
  assert.deepEqual(series.ticks.map(series.tickLabel), ["Aug", "Sep", "Oct"])
})

test("1Y plots weekly points ending today", () => {
  const series = growthSeries(days, "2026-10-11", "1y")
  assert.equal(series.points.at(-1).time, parseDay("2026-10-11"))
  assert.ok(
    series.points.every((point, index) => index === 0 || point.time - series.points[index - 1].time === 7 * 86_400_000)
  )
  assert.equal(series.added, 10)
  assert.equal(series.points.at(-1).label, "5 Oct → 11 Oct 2026")
})

test("All plots one point per month from the first user and labels years on long spans", () => {
  const series = growthSeries(days, "2026-10-11", "all")
  assert.equal(series.points[0].label, "January 2025")
  assert.equal(series.points[0].total, 10)
  assert.equal(series.points.length, 22)
  assert.equal(series.added, 20)
  assert.deepEqual(series.ticks.map(series.tickLabel), [
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
  ])
})

test("no users yet gives an empty all-time series", () => {
  const series = growthSeries([], "2026-10-11", "all")
  assert.equal(series.added, 0)
  assert.ok(series.points.every((point) => point.total === 0))
})
