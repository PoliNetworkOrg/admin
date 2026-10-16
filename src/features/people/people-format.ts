import type { StatusTone } from "@/components/primitives"
import { academicYear, dateOnlyValue } from "@/lib/date-only"
import { formatDate } from "@/lib/format"

import {
  type AccountStatus,
  type CensusAnswer,
  type CensusEntry,
  type FeeStatus,
  type MemberStatus,
  type PaymentMethod,
  type PersonRow,
  type PhotoConsent,
  type ReceiptStatus,
  type Signer,
  TEAMS,
  type TeamId,
  YEARS,
} from "./people.contract"

/** The academic year whose census and fees are current. */
export function currentYear() {
  return academicYear(todayIso())
}

export function personName(person: Pick<PersonRow, "profile">) {
  return `${person.profile.firstName} ${person.profile.lastName}`
}

export function isMember(person: Pick<PersonRow, "isMember">) {
  return person.isMember
}

export function isActiveAdmin(person: Pick<PersonRow, "admin">) {
  return person.admin?.status === "active"
}

export function activeTeams(person: Pick<PersonRow, "teams">) {
  return person.teams.filter((team) => !team.endedOn)
}

/** No active Member, Admin or Team role: the record stays for history and shows muted. */
export function hasNoRoles(person: Pick<PersonRow, "isMember" | "admin" | "teams">) {
  return !isMember(person) && !isActiveAdmin(person) && activeTeams(person).length === 0
}

/** A stored year as one of the form's options; unknown values fall back to the first year. */
export function yearOf(value: string): (typeof YEARS)[number] {
  return YEARS.find((year) => year === value) ?? "1st year"
}

const NEXT_YEAR = {
  "1st year": "2nd year",
  "2nd year": "3rd year",
  "3rd year": "1st year MSc",
  "1st year MSc": "2nd year MSc",
  "2nd year MSc": "Graduated",
  Graduated: "Graduated",
} satisfies Record<(typeof YEARS)[number], (typeof YEARS)[number]>

/** Last year's answer advanced by one, to pre-fill this year's census. */
export function nextYear(value: string) {
  return NEXT_YEAR[yearOf(value)]
}

export function teamName(team: TeamId) {
  return TEAMS[team].name
}

/** "Member", "Admin", "IT · Lead", "Capo Admin · Design". */
export function roleLabels(person: Pick<PersonRow, "isMember" | "admin" | "teams">) {
  const labels: string[] = []
  if (isMember(person)) labels.push("Member")
  if (isActiveAdmin(person)) labels.push("Admin")
  for (const team of activeTeams(person))
    labels.push(team.role === "lead" ? `${teamName(team.team)} · Lead` : teamName(team.team))
  if (person.admin?.capoScope) labels.push(`Capo Admin · ${person.admin.capoScope}`)
  return labels
}

export function censusEntry(person: Pick<PersonRow, "census">, year: string): CensusEntry | undefined {
  return person.census.find((entry) => entry.year === year)
}

/** The latest answered year, for "2026/27 · Continues". */
export function lastAnswer(person: Pick<PersonRow, "census">) {
  return [...person.census].sort((a, b) => (a.year < b.year ? 1 : -1)).find((entry) => entry.answer !== null)
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
  review: { label: "Needs review", tone: "warning" },
} satisfies Record<AccountStatus, Tone>

export const PHOTO_CONSENT = {
  granted: { label: "Granted", tone: "success" },
  denied: { label: "Denied", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
} satisfies Record<PhotoConsent, Tone>

export const MEMBER_STATUS = {
  active: { label: "Active", tone: "success", description: "Full member for the current year." },
  suspended: { label: "Suspended", tone: "danger", description: "Rights paused by the Direttivo; keeps the number." },
  expired: { label: "Expired", tone: "warning", description: "Fee not renewed; becomes Former after a year." },
  former: { label: "Former", tone: "neutral", description: "No longer a member. The number is never reused." },
} satisfies Record<MemberStatus, Tone & { description: string }>

export const FEE_STATUS = {
  paid: { label: "Paid", tone: "success" },
  receipt: { label: "Receipt uploaded", tone: "brand" },
  due: { label: "Due", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "danger" },
} satisfies Record<FeeStatus, Tone>

export const RECEIPT_STATUS = {
  toSign: { label: "To sign", tone: "warning" },
  signed: { label: "Signed", tone: "brand" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Send failed", tone: "danger" },
  voided: { label: "Voided", tone: "neutral" },
} satisfies Record<ReceiptStatus, Tone>

export const SIGNER_LABEL = { president: "President", vicePresident: "Vice-president" } satisfies Record<Signer, string>

export const PAYMENT_METHOD = { transfer: "Bank transfer", cash: "Cash" } satisfies Record<PaymentMethod, string>

export const CENSUS_ANSWER = {
  continues: { label: "Continues", tone: "success" },
  leaving: { label: "Leaving", tone: "warning" },
} satisfies Record<CensusAnswer, Tone>

export const NO_ANSWER = { label: "No answer", tone: "neutral" } satisfies Tone

export const CENSUS_SOURCE = { forms: "Imported from Forms", dashboard: "Dashboard" } as const

export function telegramUrl(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`
}

export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`
}

/** Why the backend didn't send a reminder (`skipped`). */
export const REMINDER_SKIPPED = "reminded in the last 3 days, no email address, or the email failed"
