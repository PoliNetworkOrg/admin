import type { StatusTone } from "@/components/primitives"
import { formatDate } from "@/lib/format"

import {
  type AccountStatus,
  type Assignment,
  type CampusId,
  type Course,
  type CourseLevel,
  type PersonLike,
  type PersonRecord,
  type PersonRow,
  REPRESENTATIVE_LABELS,
  SCHOOLS,
  TEAMS,
  type TeamId,
} from "./people.contract"

export function personName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`
}

/**
 * The assignments in force, as the backend counts them: not ended. An ending Auth hasn't confirmed yet already counts
 * as ended; `openAssignments` keeps it on screen.
 */
export function currentAssignments(person: Pick<PersonLike, "assignments">) {
  return person.assignments.filter((assignment) => assignment.endedOn === null)
}

export function currentAdmin(person: Pick<PersonLike, "assignments">) {
  return currentAssignments(person).find((assignment) => assignment.kind === "admin") ?? null
}

export function currentCapo(person: Pick<PersonLike, "assignments">) {
  return currentAssignments(person).find((assignment) => assignment.kind === "capo") ?? null
}

/** Current team assignments: `team` and `teamRole` are always set on them. */
export function currentTeams(person: Pick<PersonLike, "assignments">) {
  return currentAssignments(person).filter(
    (assignment): assignment is TeamAssignment => assignment.kind === "team" && assignment.team !== null
  )
}

export type TeamAssignment = Assignment & { kind: "team"; team: TeamId; teamRole: "member" | "lead" }

export function isTeamAssignment(assignment: Assignment): assignment is TeamAssignment {
  return assignment.kind === "team" && assignment.team !== null && assignment.teamRole !== null
}

/** What a record's Roles card shows: the current assignments, and the changes still waiting for or refused by Auth. */
export function openAssignments(person: Pick<PersonLike, "assignments">) {
  const refused = new Set(openRefusals(person))
  return person.assignments.filter(
    (assignment) => assignment.endedOn === null || assignment.status === "sent" || refused.has(assignment)
  )
}

/** No current role: the record stays for history and shows muted. */
export function hasNoRoles(person: Pick<PersonLike, "assignments">) {
  return currentAssignments(person).length === 0
}

/** What an assignment is about, for grouping its history: "admin", "capo" or "team:it". */
export function conceptOf(assignment: Assignment) {
  return assignment.kind === "team" ? `team:${assignment.team}` : assignment.kind
}

/**
 * Refusals someone has to act on: Auth refused a start (the assignment ended) and nobody has assigned it again, or it
 * refused an end (the role is still held).
 */
export function openRefusals(person: Pick<PersonLike, "assignments">) {
  const current = new Set(currentAssignments(person).map(conceptOf))
  return person.assignments.filter(
    (assignment) =>
      assignment.status === "refused" &&
      (assignment.endedOn === null || (assignment.change === "start" && !current.has(conceptOf(assignment))))
  )
}

export function teamName(team: TeamId) {
  return TEAMS[team].name
}

/** "Admin", "Capo Admin · Informatica", "IT · Lead", "HR". */
export function assignmentLabel(assignment: Assignment) {
  if (assignment.kind === "admin") return "Admin"
  if (assignment.kind === "capo") return assignment.capoScope ? `Capo Admin · ${assignment.capoScope}` : "Capo Admin"
  if (!assignment.team) return "Team"
  return assignment.teamRole === "lead" ? `${teamName(assignment.team)} · Lead` : teamName(assignment.team)
}

/** The current roles as labels, admin first. */
export function roleLabels(person: Pick<PersonLike, "assignments">) {
  const order = { admin: 0, capo: 1, team: 2 }
  return currentAssignments(person)
    .toSorted((a, b) => order[a.kind] - order[b.kind])
    .map(assignmentLabel)
}

type Tone = { label: string; tone: StatusTone }

/**
 * Where an assignment stands with PoliNetwork Auth. `applied` needs no badge on a current assignment, so callers may
 * skip it; the rest always show.
 */
export function assignmentState(assignment: Pick<Assignment, "status" | "change">): Tone {
  switch (assignment.status) {
    case "pending":
      return { label: "Pending until linked", tone: "neutral" }
    case "sent":
      return { label: assignment.change === "end" ? "Ending · waiting for Auth" : "Waiting for Auth", tone: "brand" }
    case "refused":
      return { label: "Refused by Auth", tone: "danger" }
    case "applied":
      return { label: "Applied", tone: "success" }
  }
}

/** Whether a role change on this record waits for Auth: the backend refuses another one until Auth answers. */
export function waitingForAuth(person: Pick<PersonLike, "assignments" | "account">) {
  return person.account.status === "linked" && person.assignments.some((assignment) => assignment.status === "sent")
}

/** "6 Oct 2026" for an ISO date (`YYYY-MM-DD`) or timestamp. */
export function formatDay(value: string) {
  return formatDate(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}

/**
 * Today in Europe/Rome as an ISO date, the calendar the backend checks start dates against ("in the future" is later
 * than this): date inputs and the roles Add person starts with use it.
 */
export function todayIso() {
  return romeDay(new Date())
}

/** The Europe/Rome calendar day of an instant, as an ISO date: `2025-08-31T23:30Z` is `2025-09-01`. */
export function romeDay(instant: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(instant))
}

export function isExpired(date: string) {
  return date < todayIso()
}

export const ACCOUNT_STATUS = {
  none: { label: "Not linked", tone: "neutral" },
  invite: { label: "Invite sent", tone: "brand" },
  linked: { label: "Linked", tone: "success" },
} satisfies Record<AccountStatus, Tone>

export const LINK_METHOD = {
  invite: "Email invite",
  manual: "Linked by hand",
  auth: "Role given in PoliNetwork Auth",
} as const

/**
 * Who did something, from the account ID the backend records: the name of the person linked to it when the page has
 * the records, otherwise the ID itself. `auth` and `system` are the backend's own actors.
 */
export function actorName(actor: string, people: readonly Pick<PersonRow, "firstName" | "lastName" | "account">[]) {
  if (actor === "auth") return "PoliNetwork Auth"
  if (actor === "system") return "System"
  const person = people.find((candidate) => candidate.account.status === "linked" && candidate.account.sub === actor)
  return person ? personName(person) : actor
}

export function telegramUrl(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`
}

export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`
}

/** Campus labels in the dashboard's English; the contract's `CAMPUSES` are the backend's Italian ones. */
export const CAMPUS_LABEL = {
  leonardo: "Leonardo",
  bovisa: "Bovisa",
  lecco: "Lecco",
  cremona: "Cremona",
  mantova: "Mantova",
  piacenza: "Piacenza",
  external: "External",
} satisfies Record<CampusId, string>

export const COURSE_LEVEL = {
  bachelor: "Bachelor's",
  master: "Master's",
  "single-cycle": "Single-cycle",
} satisfies Record<CourseLevel, string>

/**
 * "Bachelor's · 3I · DM 270 · 358": what tells two courses with similar names apart, such as one degree under the
 * current and the older regulation.
 */
export function courseDetail(course: Course) {
  return `${COURSE_LEVEL[course.level]} · ${SCHOOLS[course.school].short} · DM ${course.regulation} · ${course.code}`
}

/**
 * A representative's seats as readable lines: "CCS · Ingegneria Informatica", "School · 3I", "Senate",
 * "Board (CdA)", "Other · Comitato Sportivo". A CCS or school seat is the person's own course's.
 */
export function representativeSeats(
  person: Pick<PersonRecord, "course" | "representativeRoles" | "representativeOther">
) {
  return person.representativeRoles.map((role) => {
    if (role === "ccs" && person.course) return `${REPRESENTATIVE_LABELS.ccs} · ${person.course.name}`
    if (role === "school" && person.course)
      return `${REPRESENTATIVE_LABELS.school} · ${SCHOOLS[person.course.school].short}`
    if (role === "other" && person.representativeOther)
      return `${REPRESENTATIVE_LABELS.other} · ${person.representativeOther}`
    return REPRESENTATIVE_LABELS[role]
  })
}
