/** Parse an ISO calendar date in local time without allowing Date's overflow normalization. */
export function parseDateOnly(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}

/** Serialize the calendar day selected by a picker, preserving it across time zones. */
export function dateOnlyValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
