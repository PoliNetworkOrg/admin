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

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
// Three-letter months ("Sep", not en-GB's "Sept"), so axis labels share one width.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const tickYearFormat = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" })

function addMonths(time: number, months: number) {
  const date = new Date(time)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate())
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
 * a year, per month for all time. Days without new users carry the previous total.
 */
export function growthSeries(days: readonly UserCreationDay[], today: string, range: GrowthRange): GrowthSeries {
  const end = parseDay(today)
  const first = days.reduce((min, day) => Math.min(min, parseDay(day.date)), end)

  // Bucket ends, ascending, plus the day before the first bucket (the baseline its `added` is measured from).
  let ends: number[]
  let baseline: number
  if (range === "3m") {
    const start = addMonths(end, -3)
    ends = []
    for (let time = start; time <= end; time += DAY) ends.push(time)
    baseline = start - DAY
  } else if (range === "1y") {
    const start = addMonths(end, -12)
    ends = []
    for (let time = end; time >= start; time -= 7 * DAY) ends.unshift(time)
    baseline = (ends[0] ?? end) - 7 * DAY
  } else {
    ends = []
    for (let month = monthStart(first); month <= end; month = addMonths(month, 1)) {
      ends.push(Math.min(addMonths(month, 1) - DAY, end))
    }
    baseline = monthStart(first) - DAY
  }

  const [base = 0, ...totals] = totalsAt(days, [baseline, ...ends])
  const points = ends.map((time, index): GrowthPoint => {
    const total = totals[index] ?? 0
    const previous = index === 0 ? base : (totals[index - 1] ?? 0)
    let label: string
    if (range === "3m") label = dayFormat.format(time)
    else if (range === "1y") label = `${shortDayFormat.format(time - 6 * DAY)} → ${dayFormat.format(time)}`
    else label = monthFormat.format(time)
    return { time, total, added: total - previous, label }
  })

  const from = ends[0] ?? end
  const years = (end - from) / (365 * DAY)
  const ticks: number[] = []
  for (let month = monthStart(from); month <= end; month = addMonths(month, 1)) {
    if (month < from) continue
    if (years > 2 && new Date(month).getUTCMonth() !== 0) continue
    ticks.push(month)
  }

  return {
    points,
    ticks,
    tickLabel: (time) => (years > 2 ? tickYearFormat.format(time) : (MONTHS[new Date(time).getUTCMonth()] ?? "")),
    added: (points.at(-1)?.total ?? base) - base,
  }
}
