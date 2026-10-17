import { SHORT_MONTHS } from "../../lib/format.ts"

/** New Telegram users on one Europe/Rome calendar day ("2026-10-11"), as `tg.users.getCreationHistory` returns them. */
export type UserCreationDay = { date: string; count: number }

export type GrowthRange = "3m" | "1y" | "all"

/** One plotted bucket: the running total at its last day and the users it added. */
export type GrowthPoint = { time: number; total: number; added: number; label: string }

export type GrowthSeries = {
  points: GrowthPoint[]
  /** Month (or year, for long spans) boundaries to label on the x axis. */
  ticks: number[]
  tickLabel: (time: number) => string
  /** Users added over the whole range. */
  added: number
}

export const GROWTH_RANGES: readonly { value: GrowthRange; label: string; ariaLabel: string; span?: string }[] = [
  { value: "3m", label: "3M", ariaLabel: "Last 3 months", span: "in 3 months" },
  { value: "1y", label: "1Y", ariaLabel: "Last 12 months", span: "in 12 months" },
  { value: "all", label: "All", ariaLabel: "All time" },
]

const DAY = 86_400_000

/** Calendar days are handled as UTC midnights and formatted in UTC, so server and browser agree on every label. */
export function parseDay(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

// Labels are built from fixed English names, not Intl: ICU versions differ ("Sep" or "Sept"), and the axis, the tooltip
// and the server render must agree.
const MONTHS = SHORT_MONTHS
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** "11 Oct 2026"; without the year, "11 Oct". */
function dayLabel(time: number, withYear = true) {
  const date = new Date(time)
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
  return withYear ? `${day} ${date.getUTCFullYear()}` : day
}

/** "September 2026". */
function monthLabel(time: number) {
  const date = new Date(time)
  return `${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** The same day `months` later (or earlier), clamped to the target month's last day: 31 Dec − 3 months is 30 Sep. */
function addMonths(time: number, months: number) {
  const date = new Date(time)
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).getUTCDate()
  return target + (Math.min(date.getUTCDate(), lastDay) - 1) * DAY
}

function monthStart(time: number) {
  const date = new Date(time)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

/** The running total at the end of each requested day, for ascending `times`. */
function totalsAt(days: readonly UserCreationDay[], times: readonly number[]) {
  const sorted = days.map((day) => ({ time: parseDay(day.date), count: day.count })).sort((a, b) => a.time - b.time)
  const totals: number[] = []
  let index = 0
  let total = 0
  for (const time of times) {
    while (index < sorted.length && sorted[index].time <= time) {
      total += sorted[index].count
      index += 1
    }
    totals.push(total)
  }
  return totals
}

/**
 * The cumulative number of Telegram users over `range`, ending `today`: one point per day for 3 months, per week for
 * a year, per month for all time. Days without new users carry the previous total. `added` is the growth over exactly
 * the labelled range: the users created after the same day 3 or 12 months earlier, through today (all of them for
 * All).
 */
export function growthSeries(days: readonly UserCreationDay[], today: string, range: GrowthRange): GrowthSeries {
  const end = parseDay(today)
  const first = days.reduce((min, day) => Math.min(min, parseDay(day.date)), end)

  // Bucket ends, ascending, and `base`: the last day before the range, which the first bucket's `added` and the
  // range's growth are both measured from, so the buckets add up to exactly the range's growth.
  let ends: number[]
  let base: number
  if (range === "3m") {
    const start = addMonths(end, -3)
    ends = []
    for (let time = start + DAY; time <= end; time += DAY) ends.push(time)
    base = start
  } else if (range === "1y") {
    const start = addMonths(end, -12)
    ends = []
    for (let time = end; time > start; time -= 7 * DAY) ends.unshift(time)
    // The first week is cut at the range start.
    base = start
  } else {
    ends = []
    for (let month = monthStart(first); month <= end; month = addMonths(month, 1)) {
      ends.push(Math.min(addMonths(month, 1) - DAY, end))
    }
    base = monthStart(first) - DAY
  }

  const [baseTotal = 0] = totalsAt(days, [base])
  const endTotals = totalsAt(days, ends)
  const points = ends.map((time, index): GrowthPoint => {
    const total = endTotals[index] ?? 0
    const previous = index === 0 ? baseTotal : (endTotals[index - 1] ?? 0)
    let label: string
    if (range === "3m") label = dayLabel(time)
    else if (range === "1y") {
      const firstDay = index === 0 ? Math.max(time - 6 * DAY, base + DAY) : time - 6 * DAY
      label = firstDay === time ? dayLabel(time) : `${dayLabel(firstDay, false)} → ${dayLabel(time)}`
    } else label = monthLabel(time)
    return { time, total, added: total - previous, label }
  })

  const from = ends[0] ?? end
  const years = (end - from) / (365 * DAY)
  const crossesYear = new Date(from).getUTCFullYear() !== new Date(end).getUTCFullYear()
  const ticks: number[] = []
  for (let month = monthStart(from); month <= end; month = addMonths(month, 1)) {
    if (month < from) continue
    if (years > 2 && new Date(month).getUTCMonth() !== 0) continue
    ticks.push(month)
  }

  return {
    points,
    ticks,
    // Long spans label years; otherwise months, with the year on January when the range spans two years.
    tickLabel: (time) => {
      const date = new Date(time)
      if (years > 2) return String(date.getUTCFullYear())
      const month = MONTHS[date.getUTCMonth()] ?? ""
      return crossesYear && date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month
    },
    added: (endTotals.at(-1) ?? baseTotal) - baseTotal,
  }
}

/** Y axis ticks for the chart: about four "nice" values covering the series, and labels that never repeat. */
export type GrowthAxis = { domain: [number, number]; values: number[]; format: (value: number) => string }

const NICE_STEPS = [1, 2, 2.5, 5, 10]
const plainNumber = new Intl.NumberFormat("en-GB")

/**
 * Ticks every 1, 2, 2.5 or 5 × 10ⁿ users, roughly `count` of them, over the series' range. Below 100k the labels are
 * plain numbers ("13,325"); from 100k they are compact with as many decimals as the step needs ("1.25m"), so two
 * adjacent ticks never read the same.
 */
export function growthAxis(points: readonly Pick<GrowthPoint, "total">[], count = 4): GrowthAxis {
  const totals = points.map((point) => point.total)
  const min = totals.length ? Math.min(...totals) : 0
  const max = totals.length ? Math.max(...totals) : 0
  const span = max - min || Math.max(1, Math.abs(max) * 0.1)
  const rough = span / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, (NICE_STEPS.find((nice) => nice * magnitude >= rough) ?? 10) * magnitude)
  const low = Math.floor(min / step) * step
  const high = Math.max(Math.ceil(max / step) * step, low + step)
  const values: number[] = []
  for (let value = low; value <= high + step / 2; value += step) values.push(Math.round(value))

  const largest = Math.max(Math.abs(low), Math.abs(high))
  let format: (value: number) => string
  if (largest < 100_000) {
    format = (value) => plainNumber.format(value)
  } else {
    const [unit, suffix] = largest >= 1_000_000 ? [1_000_000, "m"] : [1_000, "k"]
    // Enough decimals to tell two values one step apart: a 25k step in millions needs two ("1.25m").
    const decimals = Math.min(3, Math.max(0, Math.ceil(-Math.log10(step / unit) - 1e-9)))
    const compact = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    format = (value) => `${compact.format(value / unit)}${suffix}`
  }
  return { domain: [low, high], values, format }
}
