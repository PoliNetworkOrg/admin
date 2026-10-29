import type { StatusTone } from "@/components/primitives"
import { dateOnlyValue } from "@/lib/date-only"
import { formatDate } from "@/lib/format"

import { type AccountStatus, type PersonRow, type PhotoConsent, TEAMS, type TeamId, YEARS } from "./people.contract"

export function personName(person: { profile: { firstName: string; lastName: string } }) {
  return `${person.profile.firstName} ${person.profile.lastName}`
}

export function isActiveAdmin(person: Pick<PersonRow, "admin">) {
  return person.admin?.status === "active"
}

export function activeTeams(person: Pick<PersonRow, "teams">) {
  return person.teams.filter((team) => !team.endedOn)
}

/** No active Admin or Team role: the record stays for history and shows muted. */
export function hasNoRoles(person: Pick<PersonRow, "admin" | "teams">) {
  return !isActiveAdmin(person) && activeTeams(person).length === 0
}

/** A stored year as one of the form's options; unknown values fall back to the first year. */
export function yearOf(value: string): (typeof YEARS)[number] {
  return YEARS.find((year) => year === value) ?? "1st year"
}

export function teamName(team: TeamId) {
  return TEAMS[team].name
}

/** "Admin", "IT · Lead", "Capo Admin · Design". */
export function roleLabels(person: Pick<PersonRow, "admin" | "teams">) {
  const labels: string[] = []
  if (isActiveAdmin(person)) labels.push("Admin")
  for (const team of activeTeams(person))
    labels.push(team.role === "lead" ? `${teamName(team.team)} · Lead` : teamName(team.team))
  if (person.admin?.capoScope) labels.push(`Capo Admin · ${person.admin.capoScope}`)
  return labels
}

/** "6 Oct 2026" for an ISO date (`YYYY-MM-DD`) or timestamp. */
export function formatDay(value: string) {
  return formatDate(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}

/** Today in the browser's timezone, as an ISO date: date inputs start from it. */
export function todayIso() {
  return dateOnlyValue(new Date())
}

export function isExpired(date: string) {
  return date < todayIso()
}

type Tone = { label: string; tone: StatusTone }

export const ACCOUNT_STATUS = {
  none: { label: "Not linked", tone: "neutral" },
  invite: { label: "Invite sent", tone: "brand" },
  linked: { label: "Linked", tone: "success" },
} satisfies Record<AccountStatus, Tone>

export const PHOTO_CONSENT = {
  granted: { label: "Granted", tone: "success" },
  denied: { label: "Denied", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
} satisfies Record<PhotoConsent, Tone>

export function telegramUrl(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`
}

export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`
}
