/**
 * The association fee's calendar, as the backend's `src/soci/fees.ts` hard-codes it from the Regolamento Interno: a fee
 * year runs from 1 September to 31 August and is renewed by 31 December. Days are `YYYY-MM-DD` in Europe/Rome.
 */

/** The fee year a day falls in, by its first calendar year: 1 September Y – 31 August Y+1 is `Y`. */
export function feeYearOf(day: string) {
  const [year = 0, month = 0] = day.split("-").map(Number)
  return month >= 9 ? year : year - 1
}

/** `2026/27`. */
export function feeYearLabel(year: number) {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`
}

/** The last day to renew: 31 December of the fee year's first calendar year. */
export function renewalDeadline(year: number) {
  return `${year}-12-31`
}

/** Whether a rejection on `today` comes after the renewal deadline, so the socio lapses unless they pay. */
export function pastDeadline(year: number, today: string) {
  return today > renewalDeadline(year)
}

/** The fee years to choose from, newest first: from this one back to the oldest admission's. */
export function feeYearsSince(oldestDay: string | null, today: string) {
  const current = feeYearOf(today)
  const first = oldestDay ? Math.min(feeYearOf(oldestDay), current) : current
  return Array.from({ length: current - first + 1 }, (_, index) => current - index)
}

/** "€5.00", with the cents. */
export function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100)
}

/** "5.00" from an amount the socio typed ("5", "5,00", "€ 5.00"), in cents; `null` when it isn't an amount. */
export function parseEuro(text: string) {
  const cleaned = text.replace(/[€\s]/g, "").replace(",", ".")
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(Number(cleaned) * 100)
  return cents > 0 ? cents : null
}

/** Uploaded transfer receipts: what the backend accepts. */
export const RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const
export const RECEIPT_ACCEPT = RECEIPT_TYPES.join(",")
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
