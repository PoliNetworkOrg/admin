import { codiceFiscaleProblem, encodedBirth, matchesBirthDate, normalizeCodiceFiscale } from "./codice-fiscale.ts"

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * The birth date (`YYYY-MM-DD`) a valid codice fiscale encodes, or null. The code keeps only two digits of the year, so
 * the century is the latest that doesn't put the birth after `today` (`YYYY-MM-DD`): on 2026-11-12, `80` is 1980 and
 * `05` is 2005. 29 February falls back a century when the nearer year isn't a leap year.
 */
export function birthDateOf(code: string, today: string): string | null {
  const normalized = normalizeCodiceFiscale(code)
  if (codiceFiscaleProblem(normalized)) return null
  const birth = encodedBirth(normalized)
  if (!birth) return null
  const century = Math.floor(Number(today.slice(0, 4)) / 100) * 100
  for (const year of [century + birth.yy, century - 100 + birth.yy]) {
    const date = new Date(Date.UTC(year, birth.month - 1, birth.day))
    const iso = `${year}-${pad(birth.month)}-${pad(birth.day)}`
    if (date.getUTCDate() === birth.day && iso <= today) return iso
  }
  return null
}

/**
 * The birth date to keep once the codice fiscale reads `code`: the one the code encodes, unless the code isn't valid yet
 * or `birthDate` already agrees with it (a date a century earlier, typed by hand, stays).
 */
export function birthDateFor(code: string, birthDate: string, today: string) {
  const encoded = birthDateOf(code, today)
  if (!encoded) return birthDate
  if (birthDate !== "" && matchesBirthDate(normalizeCodiceFiscale(code), birthDate)) return birthDate
  return encoded
}
