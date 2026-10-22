import { createHash } from "node:crypto"

import type { PeopleApi, PeopleViewer } from "./people.api.server"
import {
  type AccountMatch,
  type Campaign,
  type CampaignDetail,
  type CapoArea,
  type Discrepancy,
  type ImportPreview,
  type MyArea,
  type PersonRecord,
  type PersonRow,
  TEAM_IDS,
  TEAMS,
  type TeamId,
  type TeamSummary,
} from "./people.contract"
import {
  addDays,
  buildPeopleStore,
  FAMILIES,
  FAMILY_IDS,
  GROUP_IDS,
  m365Address,
  type PeopleStore,
  type StoredPerson,
} from "./people.fixtures.server"

/**
 * Agent mode's stand-in for the backend's `people.*` procedures, over `people.fixtures.server.ts`. State lives for the
 * dev server's lifetime, so mutations show up on reload. It enforces the same visibility rules the backend must:
 * contacts and notes only with `people:read`, a Capo Admin's scope, or a Team Lead's team.
 */

let store: PeopleStore | null = null
/** The agent user's own state when `AGENT_PERSON` is `none` or `match:P-…`. */
type SelfState = {
  matchConfirmed: boolean
  matchRejected: boolean
  askedOn: string | null
  /** The record linked through an invite link, which replaces `AGENT_PERSON`. */
  invitedId: string | null
}
const self: SelfState = { matchConfirmed: false, matchRejected: false, askedOn: null, invitedId: null }
const importedFiles = new Set<string>()
const previews = new Map<string, ImportPreview>()
const closedCampaigns = new Set<string>()

function data() {
  store ??= buildPeopleStore()
  return store
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowStamp() {
  return new Date().toISOString()
}

function fullName(person: StoredPerson) {
  return `${person.profile.firstName} ${person.profile.lastName}`
}

function find(id: string) {
  const person = data().byId.get(id)
  if (!person) throw new Error("This person no longer exists.")
  return person
}

function log(person: StoredPerson, actor: string, text: string) {
  person.activity.unshift({ actor, text, at: nowStamp() })
}

function discrepancies(person: StoredPerson): Discrepancy[] {
  const out: Discrepancy[] = []
  for (const pending of person.pendingGroupRemovals ?? [])
    out.push({ kind: "needs-review", message: pending.message, suggestedTelegram: null })
  const current = person.census.find((entry) => entry.year === "2026/27")
  const isMember = person.member !== null && person.member.status !== "former"
  if (current?.declaredMember && !isMember) {
    out.push({
      kind: "declared-member",
      message: "Declared a member in the 2026/27 census, but not in the member register.",
      suggestedTelegram: null,
    })
  }
  if (person.censusTelegram && person.censusTelegram !== person.profile.telegramUsername) {
    out.push({
      kind: "telegram-mismatch",
      message: `The 2026/27 census says @${person.censusTelegram}, but the record says @${person.profile.telegramUsername ?? "—"}.`,
      suggestedTelegram: person.censusTelegram,
    })
  }
  if (person.account.status === "review") {
    out.push({
      kind: "needs-review",
      message: "A sign-in matches this record but needs review before it can be linked.",
      suggestedTelegram: null,
    })
  }
  return out
}

/**
 * The contract row, with contacts kept only when `withContacts`. Member details (number, status, fee, Microsoft 365
 * address) need `people:members:read` or the person's own record; everyone else sees only `isMember`.
 */
function row(person: StoredPerson, viewer: PeopleViewer, withContacts: boolean): PersonRow {
  const ownRecord = linkedRecord(viewer)?.id === person.id
  const withMember = ownRecord || viewer.permissions.includes("people:members:read")
  return {
    id: person.id,
    profile: {
      ...person.profile,
      personalEmail: withContacts ? person.profile.personalEmail : null,
      phone: withContacts ? person.profile.phone : null,
    },
    member: withMember ? person.member : null,
    isMember: person.member !== null && person.member.status !== "former",
    admin: person.admin,
    teams: person.teams,
    census: person.census,
    consents: person.consents,
    account: person.account,
  }
}

function record(person: StoredPerson, viewer: PeopleViewer): PersonRecord {
  const canRead = viewer.permissions.includes("people:read")
  return {
    ...row(person, viewer, canRead || linkedRecord(viewer)?.id === person.id),
    notes: canRead ? person.notes : null,
    discrepancies: discrepancies(person),
    activity: [...person.activity].sort((a, b) => (a.at < b.at ? 1 : -1)),
  }
}

function require(viewer: PeopleViewer, permission: string) {
  if (!viewer.permissions.includes(permission)) throw new Error("UNAUTHORIZED")
}

function viewerName(viewer: PeopleViewer) {
  const person = viewer.personId ? data().byId.get(viewer.personId) : undefined
  return person ? fullName(person) : "Agent"
}

/** The person the agent user is in My area: `AGENT_PERSON` without its `match:` prefix. */
function viewerRecord(viewer: PeopleViewer) {
  if (self.invitedId) return data().byId.get(self.invitedId) ?? null
  if (!viewer.personId || viewer.personId === "none") return null
  const id = viewer.personId.replace(/^match:/, "")
  return data().byId.get(id) ?? null
}

/**
 * The record the signed-in person acts as. A first-sign-in match (`match:` prefix) is not theirs until they confirm
 * it, and never after "This isn't me": until then they see the proposed match in My area and nothing else.
 */
function linkedRecord(viewer: PeopleViewer) {
  if (self.matchRejected) return null
  if (viewer.personId?.startsWith("match:") && !self.matchConfirmed) return null
  return viewerRecord(viewer)
}

/**
 * An invite link's token. Agent mode derives it from the record and the send date, so links survive a dev server
 * restart (to switch `AGENT_PERSON`); the backend issues random tokens and stores them hashed.
 */
function inviteToken(personId: string, sentOn: string) {
  return createHash("sha256").update(`people-invite:${personId}:${sentOn}`).digest("base64url")
}

/**
 * One CSV cell, quoted. A value starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`, so
 * spreadsheet apps show it as text instead of running it as a formula (OWASP CSV injection).
 */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

/**
 * A request to join one of the groups the signed-in Capo Admin coordinates. Any other request reads as already
 * handled, so a caller can't tell whether a request of another course exists.
 */
function capoRequest(viewer: PeopleViewer, requestId: string) {
  const scope = linkedRecord(viewer)?.admin?.capoScope
  const family = scope ? familyOfScope(scope) : undefined
  const titles: readonly string[] = family ? FAMILIES[family].groups : []
  const request = data().joinRequests.find(
    (candidate) => candidate.id === requestId && titles.includes(candidate.group)
  )
  if (!request) throw new Error("This request was already handled.")
  return request
}

function leadsOf(person: StoredPerson | null): TeamId[] {
  if (!person) return []
  return person.teams.filter((team) => team.role === "lead" && !team.endedOn).map((team) => team.team)
}

function campaigns(): Campaign[] {
  const people = data().people
  const count = (year: string) => {
    const entries = people.flatMap((person) => person.census.filter((entry) => entry.year === year))
    const expected = year === "2026/27" ? people.filter((person) => person.expected).length : entries.length
    const continuing = entries.filter((entry) => entry.answer === "continues").length
    const leaving = entries.filter((entry) => entry.answer === "leaving").length
    return { expected, continuing, leaving, noAnswer: expected - continuing - leaving }
  }
  return [
    {
      id: "2026",
      year: "2026/27",
      status: closedCampaigns.has("2026") ? "closed" : "open",
      openedOn: "2026-09-15",
      closesOn: "2026-10-31",
      source: "Modulo Volontari 2026/27",
      ...count("2026/27"),
    },
    {
      id: "2025",
      year: "2025/26",
      status: "closed",
      openedOn: "2025-09-15",
      closesOn: "2025-10-31",
      source: "Modulo Volontari 2025/26",
      ...count("2025/26"),
    },
  ]
}

function familyOfScope(scope: string) {
  return FAMILY_IDS.find((family) => FAMILIES[family].scope === scope)
}

function buildPreview(fileName: string): ImportPreview {
  const people = data().people.filter((person) => person.census.some((entry) => entry.source === "forms"))
  const reimport = importedFiles.has(fileName)
  const withErrors = fileName.toLowerCase().endsWith(".csv")
  const answer = (person: StoredPerson) =>
    person.census.find((entry) => entry.year === "2026/27")?.answer ?? "continues"
  const newNames = [
    "Leonardo Sala",
    "Greta Bellini",
    "Samuele Riva",
    "Ludovica Neri",
    "Emanuele Vitali",
    "Arianna Donati",
    "Jacopo Piras",
    "Bianca Sartori",
    "Diego Milani",
  ]
  const counts = reimport
    ? { newPeople: 4, updates: 8, duplicates: 0, invalid: 0, discrepancies: 1, alreadyImported: 148, leaving: 1 }
    : {
        newPeople: 9,
        updates: 136,
        duplicates: 3,
        invalid: withErrors ? 4 : 0,
        discrepancies: 6,
        alreadyImported: 0,
        leaving: 7,
      }
  const giulia = find("P-0142")
  const duplicatePeople = people.slice(10, 10 + counts.duplicates)
  return {
    importId: `import-${Date.now()}`,
    fileName,
    rows: reimport ? 160 : withErrors ? 152 : 148,
    counts,
    tabs: {
      newPeople: newNames.slice(0, counts.newPeople).map((name, index) => ({
        row: 140 + index,
        name,
        detail: [
          "Ingegneria Gestionale · 1st year · Bovisa",
          "Design della Comunicazione · 1st year · Bovisa",
          "Ingegneria Informatica · 1st year · Leonardo",
        ][index % 3],
        answer: "continues",
      })),
      updates: people.slice(0, Math.min(8, counts.updates)).map((person, index) => ({
        row: 3 + index * 7,
        name: fullName(person),
        detail: [
          `Year ${person.profile.year} → next year`,
          "Campus Leonardo → Bovisa",
          "Phone updated",
          "Telegram username updated",
        ][index % 4],
        answer: answer(person),
      })),
      duplicates: duplicatePeople.map((person, index) => ({
        row: 44 + index * 31,
        name: fullName(person),
        detail:
          index === 1
            ? `Same name as ${person.id}; different course and Telegram`
            : `Same name as ${person.id}; same Telegram, different email`,
        answer: "continues",
      })),
      invalid: [
        { row: 23, name: "Pietro Gallo", detail: "Personal email is missing", answer: null },
        { row: 57, name: "Unnamed row", detail: "Name is empty", answer: null },
        { row: 88, name: "Sofia Marchetti", detail: "Year “4th” isn't a valid year", answer: null },
        { row: 131, name: "Luca Moretti", detail: "Telegram username “luca moretti” has a space", answer: null },
      ].slice(0, counts.invalid),
      discrepancies: [
        {
          row: 12,
          name: fullName(giulia),
          detail: "Declared a member, but not in the member register",
          answer: "continues" as const,
        },
        ...people.slice(20, 20 + counts.discrepancies - 1).map((person, index) => ({
          row: 30 + index * 9,
          name: fullName(person),
          detail: [
            "Telegram username differs from the record",
            "Says they administer Statistica; the bot hasn't seen them there",
            "Campus Cremona in the form, Leonardo on the record",
            "Answered “No” but administers 2 groups",
          ][index % 4],
          answer: answer(person),
        })),
      ].slice(0, counts.discrepancies),
      alreadyImported: reimport
        ? people.slice(0, 8).map((person, index) => ({
            row: 1 + index,
            name: fullName(person),
            detail: "Already imported, skipped",
            answer: answer(person),
          }))
        : [],
    },
    duplicates: duplicatePeople.map((person, index) => {
      const fileEmail =
        index === 1
          ? `${person.profile.firstName.toLowerCase()}.${person.profile.lastName.toLowerCase()}@mail.polimi.it`
          : (person.profile.personalEmail ?? "").replace("@", "1@")
      const telegram = `@${person.profile.telegramUsername ?? "—"}`
      return {
        pairId: `pair-${index}`,
        row: 44 + index * 31,
        recordId: person.id,
        fields: [
          { label: "Name", file: fullName(person), record: fullName(person), mono: false },
          { label: "Email", file: fileEmail, record: person.profile.personalEmail ?? "—", mono: true },
          {
            label: "Course",
            file: index === 1 ? "Ingegneria Civile" : person.profile.course,
            record: person.profile.course,
            mono: false,
          },
          { label: "Telegram", file: index === 1 ? `${telegram}99` : telegram, record: telegram, mono: true },
          { label: "Year", file: person.profile.year, record: person.profile.year, mono: false },
        ],
      }
    }),
    telegram: people.slice(30, 36).map((person, index) => ({
      rowId: `row-${person.id}`,
      name: fullName(person),
      username: `@${person.profile.telegramUsername ?? `${person.profile.firstName.toLowerCase()}`}`,
      suggestion:
        index === 4
          ? null
          : {
              telegramId: person.profile.telegramId ?? "",
              name: fullName(person),
              info: person.admin ? `Admin in ${Math.max(1, person.admin.groups.length)} groups` : "Member of 3 groups",
            },
    })),
  }
}

export function fakePeopleApi(viewer: PeopleViewer): PeopleApi {
  const actor = viewerName(viewer)
  return {
    listMembers: async () => {
      require(viewer, "people:members:read")
      return data().people.map((person) => ({
        id: person.id,
        profile: {
          firstName: person.profile.firstName,
          lastName: person.profile.lastName,
          personalEmail: viewer.permissions.includes("people:read") ? person.profile.personalEmail : null,
        },
        member: person.member,
        account: { status: person.account.status },
      }))
    },
    listPeople: async () => {
      require(viewer, "people:read")
      return data().people.map((person) => row(person, viewer, true))
    },
    getPerson: async (id) => {
      require(viewer, "people:read")
      return record(find(id), viewer)
    },
    createPerson: async (input) => {
      require(viewer, "people:write")
      const { people, byId } = data()
      if (people.some((person) => person.profile.personalEmail === input.personalEmail)) {
        throw new Error(`${input.personalEmail} already belongs to another record.`)
      }
      const id = `P-${String(people.length + 1).padStart(4, "0")}`
      const person: StoredPerson = {
        id,
        family: "inf",
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          personalEmail: input.personalEmail,
          phone: input.phone || null,
          telegramUsername: input.telegramUsername || null,
          telegramId: null,
          course: input.course,
          year: input.year,
          campus: input.campus,
          otherAssociations: [],
          studentRepresentative: null,
        },
        member: null,
        admin: input.admin
          ? {
              status: "active",
              since: today(),
              endedOn: null,
              endReason: null,
              groups: [],
              requested: [],
              availableAsCapo: false,
              capoOfReference: null,
              capoScope: null,
            }
          : null,
        teams: [],
        census: [],
        consents: { privacy: null, photo: null },
        account: { status: "none" },
        notes: null,
        activity: [],
        start: input.admin ? today() : null,
        censusTelegram: null,
        expected: false,
      }
      log(person, actor, "created the record")
      people.push(person)
      byId.set(id, person)
      return { id }
    },
    updatePerson: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      Object.assign(person.profile, {
        firstName: input.firstName,
        lastName: input.lastName,
        personalEmail: input.personalEmail,
        phone: input.phone || null,
        telegramUsername: input.telegramUsername || null,
        course: input.course,
        year: input.year,
        campus: input.campus,
      })
      log(person, actor, "edited the profile")
    },
    setNote: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      person.notes = input.note || null
      log(person, actor, "edited the HR notes")
    },
    createMember: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (person.member) throw new Error("This person is already registered as a member.")
      if (data().people.some((other) => other.member?.number === input.number)) {
        throw new Error(`Member number ${input.number} is already taken.`)
      }
      person.member = {
        number: input.number,
        status: "active",
        admittedOn: input.admittedOn,
        fee: input.fee,
        m365Email: m365Address(person.profile.firstName, person.profile.lastName),
      }
      log(person, actor, `admitted ${person.profile.firstName} as member ${input.number}`)
    },
    setMemberStatus: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (!person.member) throw new Error("This person isn't a member.")
      person.member.status = input.status
      if (input.status === "former") person.member.fee = null
      log(person, actor, `changed the member status to ${input.status}${input.reason ? `: ${input.reason}` : ""}`)
    },
    setMemberNumber: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (!person.member) throw new Error("This person isn't a member.")
      const taken = data().people.find((other) => other !== person && other.member?.number === input.number)
      if (taken) throw new Error(`Member number ${input.number} belongs to ${fullName(taken)}.`)
      const previous = person.member.number
      person.member.number = input.number
      log(person, actor, `changed the member number from ${previous} to ${input.number}`)
    },
    exportMembers: async () => {
      require(viewer, "people:members:write")
      const lines = [["Number", "Name", "Status", "Admitted on", "Fee", "Microsoft 365"].join(",")]
      for (const person of data().people) {
        const member = person.member
        if (!member) continue
        lines.push(
          [member.number, fullName(person), member.status, member.admittedOn, member.fee ?? "", member.m365Email]
            .map(csvCell)
            .join(",")
        )
      }
      return { filename: `member-register-${today()}.csv`, csv: lines.join("\n") }
    },
    endAdmin: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("This person isn't an active admin.")
      if (person.admin.capoScope) require(viewer, "people:appoint")
      Object.assign(person.admin, {
        status: "former",
        endedOn: today(),
        endReason: input.reason,
        groups: [],
        requested: [],
        capoScope: null,
      })
      log(person, actor, `ended the admin role: ${input.reason}`)
    },
    setCapoScope: async (input) => {
      require(viewer, "people:appoint")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("Only active admins can be Capo Admins.")
      person.admin.capoScope = input.scope
      log(
        person,
        actor,
        input.scope ? `appointed ${person.profile.firstName} Capo Admin of ${input.scope}` : "ended the Capo Admin role"
      )
    },
    setCapoOfReference: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("Only active admins have a Capo Admin.")
      if (input.capoId === null) {
        person.admin.capoOfReference = null
        log(person, actor, "removed the Capo Admin of reference")
        return
      }
      const capo = find(input.capoId)
      if (!capo.admin?.capoScope) throw new Error(`${fullName(capo)} isn't a Capo Admin.`)
      person.admin.capoOfReference = { id: capo.id, name: fullName(capo) }
      log(person, actor, `set ${fullName(capo)} as Capo Admin of reference`)
    },
    listTeams: async () => {
      const canRead = viewer.permissions.includes("people:read")
      const leads = leadsOf(linkedRecord(viewer))
      if (!canRead && !leads.length) throw new Error("UNAUTHORIZED")
      const teams: TeamSummary[] = []
      for (const id of TEAM_IDS) {
        if (!canRead && !leads.includes(id)) continue
        const members = data().people.filter((person) => person.teams.some((team) => team.team === id))
        const lead = members.find((person) =>
          person.teams.some((team) => team.team === id && team.role === "lead" && !team.endedOn)
        )
        teams.push({
          id,
          name: TEAMS[id].name,
          lead: lead ? { id: lead.id, name: fullName(lead) } : null,
          // A Lead sees contacts of current members only, not of people who left the team.
          members: members.map((person) =>
            row(person, viewer, canRead || person.teams.some((team) => team.team === id && !team.endedOn))
          ),
        })
      }
      return teams
    },
    listTeamCandidates: async (input) => {
      const canRead = viewer.permissions.includes("people:read")
      if (!canRead && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      return data()
        .people.filter((person) => !person.teams.some((team) => team.team === input.teamId && !team.endedOn))
        .map((person) => ({ id: person.id, name: fullName(person), course: person.profile.course }))
        .toSorted((a, b) => a.name.localeCompare(b.name))
    },
    addTeamMember: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      if (input.role === "lead") require(viewer, "people:appoint")
      const person = find(input.personId)
      if (person.teams.some((team) => team.team === input.teamId && !team.endedOn)) {
        throw new Error(`${fullName(person)} is already in ${TEAMS[input.teamId].name}.`)
      }
      person.teams.push({
        team: input.teamId,
        role: input.role,
        since: input.since,
        endedOn: null,
        endReason: null,
        fields: input.fields,
      })
      log(
        person,
        actor,
        `added ${person.profile.firstName} to ${TEAMS[input.teamId].name} as ${input.role === "lead" ? "Team Lead" : "Member"}`
      )
    },
    updateTeamFields: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      const membership = find(input.personId).teams.find((team) => team.team === input.teamId && !team.endedOn)
      if (!membership) throw new Error("This membership has ended.")
      membership.fields = input.fields
    },
    endTeamMembership: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      const person = find(input.personId)
      const membership = person.teams.find((team) => team.team === input.teamId && !team.endedOn)
      if (!membership) throw new Error("This membership has already ended.")
      if (membership.role === "lead") require(viewer, "people:appoint")
      membership.endedOn = input.lastDay
      membership.endReason = input.reason
      log(person, actor, `ended the ${TEAMS[input.teamId].name} membership: ${input.reason}`)
    },
    listCampaigns: async () => {
      require(viewer, "people:read")
      return campaigns()
    },
    getCampaign: async (id) => {
      require(viewer, "people:read")
      const campaign = campaigns().find((candidate) => candidate.id === id)
      if (!campaign) throw new Error("NOT_FOUND")
      const people =
        campaign.status === "open"
          ? data().people.filter((person) => person.expected)
          : data().people.filter((person) => person.census.some((entry) => entry.year === campaign.year))
      return { campaign, people: people.map((person) => row(person, viewer, true)) } satisfies CampaignDetail
    },
    getAnswers: async (input) => {
      require(viewer, "people:read")
      const person = find(input.personId)
      const entry = person.census.find((candidate) => candidate.year === input.year)
      if (!entry?.answer) throw new Error("No answer for this year.")
      return [
        {
          question: `Will you continue volunteering in ${input.year}?`,
          answer: entry.answer === "continues" ? "Yes" : "No",
        },
        ...(entry.answer === "leaving"
          ? [{ question: "Why are you leaving?", answer: person.admin?.endReason ?? "Graduating" }]
          : []),
        { question: "Course and year", answer: `${person.profile.course}, ${person.profile.year}` },
        { question: "Campus", answer: person.profile.campus },
        {
          question: "Telegram username",
          answer: `@${person.censusTelegram ?? person.profile.telegramUsername ?? "—"}`,
        },
        {
          question: "Groups you administer",
          answer: person.admin?.groups.map((group) => group.title).join(", ") || "—",
        },
        { question: "Are you a PoliNetwork member (socio)?", answer: entry.declaredMember ? "Yes" : "No" },
        { question: "Available as Capo Admin?", answer: person.admin?.availableAsCapo ? "Yes" : "No" },
        {
          question: "Photo and video consent",
          answer: person.consents.photo?.status === "granted" ? "I agree" : "I don't agree",
        },
      ]
    },
    remind: async (input) => {
      require(viewer, "people:write")
      if (campaigns().find((campaign) => campaign.id === input.campaignId)?.status !== "open") {
        throw new Error("Reminders go out only while the campaign is open.")
      }
      const targets = data().people.filter(
        (person) =>
          person.expected &&
          (input.personId === null || person.id === input.personId) &&
          person.census.some((entry) => entry.year === "2026/27" && entry.answer === null)
      )
      let sent = 0
      let skipped = 0
      for (const person of targets) {
        const entry = person.census.find((candidate) => candidate.year === "2026/27")
        if (!entry) continue
        if (input.personId === null && entry.reminders >= 2) {
          skipped++
          continue
        }
        entry.reminders++
        sent++
      }
      return { sent, skipped }
    },
    closeCampaign: async (id) => {
      require(viewer, "people:write")
      const campaign = campaigns().find((candidate) => candidate.id === id)
      if (!campaign) throw new Error("NOT_FOUND")
      if (campaign.status === "closed") throw new Error("This campaign is already closed.")
      closedCampaigns.add(id)
    },
    importPreview: async (_campaignId, file) => {
      require(viewer, "people:write")
      const preview = buildPreview(file.name)
      previews.set(preview.importId, preview)
      return preview
    },
    importCommit: async (input) => {
      require(viewer, "people:write")
      const preview = previews.get(input.importId)
      if (!preview) throw new Error("This import expired. Upload the file again.")
      importedFiles.add(preview.fileName)
      previews.delete(input.importId)
      return { imported: preview.rows - preview.counts.invalid - preview.counts.alreadyImported }
    },
    listReviews: async () => {
      require(viewer, "people:read")
      return data().reviews
    },
    resolveReview: async (input) => {
      require(viewer, "people:write")
      const store = data()
      const review = store.reviews.find((candidate) => candidate.id === input.reviewId)
      if (!review) throw new Error("This item was already resolved.")
      store.reviews = store.reviews.filter((candidate) => candidate !== review)
      const linksOther = ["link-other", "link-second"].includes(input.resolution)
      const linked = linksOther ? review.other : review.record
      const target = linked ? store.byId.get(linked.id) : undefined
      if (
        target &&
        ["move-telegram", "link-other", "link-first", "link-second", "link-anyway"].includes(input.resolution)
      ) {
        target.account = {
          status: "linked",
          email: review.account.email,
          via: review.account.via,
          linkedOn: today(),
          how: `Resolved by ${actor}`,
        }
        log(target, actor, `linked ${review.account.email}: ${input.reason}`)
      } else if (target && target.account.status === "review") {
        target.account = { status: "none" }
      }
    },
    dismissReview: async (input) => {
      require(viewer, "people:write")
      const store = data()
      const review = store.reviews.find((candidate) => candidate.id === input.reviewId)
      store.reviews = store.reviews.filter((candidate) => candidate.id !== input.reviewId)
      const target = review?.record ? store.byId.get(review.record.id) : undefined
      if (target?.account.status === "review") target.account = { status: "none" }
    },
    listInvites: async () => {
      require(viewer, "people:read")
      return data().people.flatMap((person) =>
        person.account.status === "invite"
          ? [
              {
                personId: person.id,
                name: fullName(person),
                email: person.account.email,
                sentOn: person.account.sentOn,
                expiresOn: person.account.expiresOn,
                sentBy: person.account.sentBy,
              },
            ]
          : []
      )
    },
    sendInvite: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status === "linked") throw new Error(`${fullName(person)} has already linked an account.`)
      if (!person.profile.personalEmail) throw new Error("Add a personal email before sending an invite.")
      person.account = {
        status: "invite",
        email: person.profile.personalEmail,
        sentOn: today(),
        expiresOn: addDays(today(), 14),
        sentBy: actor,
      }
      log(person, actor, `sent an invite to ${person.profile.personalEmail}`)
      // Agent mode sends no email: the link goes to the dev server's console instead.
      console.info(
        `[agent mode] Invite link for ${person.id}: /dashboard/account/me?peopleInvite=${inviteToken(person.id, today())}`
      )
    },
    revokeInvite: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status !== "invite") throw new Error("There is no pending invite.")
      person.account = { status: "none" }
      log(person, actor, "revoked the invite")
    },
    searchAccounts: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      const { firstName, lastName, personalEmail, telegramUsername } = person.profile
      const otherFirst = `${firstName.slice(0, -1)}${firstName.endsWith("a") ? "o" : "a"}`
      const accounts: AccountMatch[] = [
        {
          id: "acc-1",
          name: fullName(person),
          email: personalEmail ?? `${firstName.toLowerCase()}@gmail.com`,
          telegram: telegramUsername ? `@${telegramUsername}` : null,
          via: "Signed in with Telegram on 13 Oct 2026",
          linkedTo: null,
          reason: "same-telegram",
        },
        {
          id: "acc-2",
          name: `${firstName} ${lastName}ni`,
          email: `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}ni@outlook.it`,
          telegram: null,
          via: "Signed in with Google on 2 Oct 2026",
          linkedTo: null,
          reason: "similar-name",
        },
        {
          id: "acc-3",
          name: `${otherFirst} ${lastName}`,
          email: `${otherFirst.toLowerCase()}.${lastName.toLowerCase()}@mail.polimi.it`,
          telegram: null,
          via: "Signed in with Microsoft 365 on 28 Sep 2026",
          linkedTo: { id: "P-0057", name: `${otherFirst} ${lastName}` },
          reason: "similar-name",
        },
      ]
      const query = input.query.toLowerCase().replace(/^@/, "")
      return query
        ? accounts.filter((account) =>
            `${account.name} ${account.email} ${account.telegram ?? ""}`.toLowerCase().includes(query)
          )
        : accounts
    },
    linkAccount: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      const accounts = await fakePeopleApi(viewer).searchAccounts({ personId: input.personId, query: "" })
      const account = accounts.find((candidate) => candidate.id === input.accountId)
      if (!account) throw new Error("This account no longer exists.")
      if (account.linkedTo) {
        throw new Error(
          `This account is already linked to ${account.linkedTo.name} (${account.linkedTo.id}). Unlink it there first, or pick another account.`
        )
      }
      person.account = {
        status: "linked",
        email: account.email,
        via: account.via.split(" on ")[0].replace("Signed in with ", ""),
        linkedOn: today(),
        how: `Linked by ${actor}`,
      }
      log(person, actor, `linked ${account.email}: ${input.reason}`)
    },
    unlinkAccount: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status !== "linked") throw new Error("No account is linked.")
      log(person, actor, `unlinked ${person.account.email}`)
      person.account = { status: "none" }
    },
    getCapoArea: async () => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      const scope = me?.admin?.capoScope
      const family = scope ? familyOfScope(scope) : undefined
      if (!scope || !family) throw new Error("UNAUTHORIZED")
      const titles = FAMILIES[family].groups
      const admins = data().people.filter(
        (person) =>
          person.admin?.status === "active" && person.admin.groups.some((group) => titles.includes(group.title))
      )
      return {
        scope,
        groups: titles.map((title) => ({
          chatId: GROUP_IDS.get(title) ?? "",
          title,
          admins: admins.filter((person) => person.admin?.groups.some((group) => group.title === title)).length,
        })),
        admins: admins.map((person) => ({
          ...row(person, viewer, true),
          profile: { ...person.profile, personalEmail: null },
        })),
        requests: data()
          .joinRequests.filter((request) => titles.includes(request.group))
          .map((request) => {
            const person = find(request.personId)
            return {
              id: request.id,
              person: { id: person.id, name: fullName(person) },
              group: { chatId: GROUP_IDS.get(request.group) ?? "", title: request.group },
              requestedOn: request.requestedOn,
            }
          }),
      } satisfies CapoArea
    },
    approveJoinRequest: async (input) => {
      require(viewer, "people:self")
      const store = data()
      const request = capoRequest(viewer, input.requestId)
      const person = find(request.personId)
      if (person.admin && !person.admin.groups.some((group) => group.title === request.group)) {
        person.admin.groups.push({ chatId: GROUP_IDS.get(request.group) ?? "", title: request.group })
        person.admin.requested = person.admin.requested.filter((group) => group.title !== request.group)
      }
      store.joinRequests = store.joinRequests.filter((candidate) => candidate !== request)
      log(person, actor, `approved ${person.profile.firstName} as admin of ${request.group}`)
    },
    declineJoinRequest: async (input) => {
      require(viewer, "people:self")
      const store = data()
      const request = capoRequest(viewer, input.requestId)
      const person = find(request.personId)
      if (person.admin) person.admin.requested = person.admin.requested.filter((group) => group.title !== request.group)
      store.joinRequests = store.joinRequests.filter((candidate) => candidate !== request)
    },
    getMyRoles: async () => {
      const me = linkedRecord(viewer)
      return { capoScope: me?.admin?.capoScope ?? null, leads: leadsOf(me) }
    },
    getMyArea: async () => {
      require(viewer, "people:self")
      const me = viewerRecord(viewer)
      if (!me || self.matchRejected)
        return { state: "none", request: self.askedOn ? { sentOn: self.askedOn } : null } satisfies MyArea
      if (viewer.personId?.startsWith("match:") && !self.matchConfirmed) {
        const roles = [
          ...(me.member && me.member.status !== "former" ? ["Member"] : []),
          ...(me.admin?.status === "active" ? ["Admin"] : []),
          ...me.teams.filter((team) => !team.endedOn).map((team) => TEAMS[team.team].name),
        ]
        return {
          state: "match",
          candidate: {
            id: me.id,
            name: fullName(me),
            course: me.profile.course,
            year: me.profile.year,
            campus: me.profile.campus,
            roles,
          },
          reason: me.profile.telegramUsername
            ? `Matched on your verified Telegram account, @${me.profile.telegramUsername}.`
            : "Matched on your email address.",
        } satisfies MyArea
      }
      const contacts: Extract<MyArea, { state: "linked" }>["contacts"] = []
      const capo = me.admin?.capoOfReference ? data().byId.get(me.admin.capoOfReference.id) : undefined
      if (capo)
        contacts.push({
          role: "capo",
          name: fullName(capo),
          telegram: capo.profile.telegramUsername,
          email: null,
          team: null,
        })
      for (const membership of me.teams.filter((team) => !team.endedOn)) {
        const lead = data().people.find(
          (person) =>
            person !== me &&
            person.teams.some((team) => team.team === membership.team && team.role === "lead" && !team.endedOn)
        )
        if (lead)
          contacts.push({
            role: "lead",
            name: fullName(lead),
            telegram: lead.profile.telegramUsername,
            email: null,
            team: membership.team,
          })
      }
      contacts.push({ role: "hr", name: "HR team", telegram: null, email: "hr@polinetwork.org", team: null })
      const team = me.teams.find((membership) => !membership.endedOn)?.team ?? null
      const roster = team
        ? {
            team,
            members: data()
              .people.flatMap((person) => {
                const membership = person.teams.find((candidate) => candidate.team === team && !candidate.endedOn)
                if (!membership) return []
                const email =
                  person.member || person.account.status === "linked"
                    ? m365Address(person.profile.firstName, person.profile.lastName)
                    : null
                return [
                  {
                    id: person.id,
                    name: fullName(person),
                    role: membership.role,
                    telegram: person.profile.telegramUsername,
                    email,
                  },
                ]
              })
              .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "lead" ? -1 : 1)),
          }
        : null
      return {
        state: "linked",
        person: { ...record(me, { ...viewer, personId: me.id }), notes: null },
        campaign: me.expected ? { id: "2026", year: "2026/27", closesOn: "2026-10-31" } : null,
        contacts,
        roster,
      } satisfies MyArea
    },
    confirmMatch: async () => {
      require(viewer, "people:self")
      const me = viewerRecord(viewer)
      if (!me || self.matchRejected || !viewer.personId?.startsWith("match:")) {
        throw new Error("There is no record to link.")
      }
      self.matchConfirmed = true
      me.account = {
        status: "linked",
        email: me.profile.personalEmail ?? "",
        via: "Telegram",
        linkedOn: today(),
        how: `Confirmed by ${fullName(me)} at first sign-in`,
      }
    },
    rejectMatch: async () => {
      require(viewer, "people:self")
      self.matchRejected = true
      self.askedOn = today()
    },
    acceptInvite: async (input) => {
      require(viewer, "people:self")
      if (linkedRecord(viewer)) throw new Error("Your account is already linked to a record.")
      // The token alone identifies the invited record: never the caller's own match.
      const me = data().people.find(
        (person) =>
          person.account.status === "invite" &&
          person.account.expiresOn >= today() &&
          inviteToken(person.id, person.account.sentOn) === input.token
      )
      if (me?.account.status !== "invite") throw new Error("This invitation has expired or was revoked.")
      Object.assign(self, { invitedId: me.id, matchConfirmed: true, matchRejected: false })
      me.account = {
        status: "linked",
        email: me.account.email,
        via: "Email",
        linkedOn: today(),
        how: "Accepted the email invitation",
      }
    },
    askToBeAdded: async () => {
      require(viewer, "people:self")
      self.askedOn = today()
    },
    answerCensus: async (input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me) throw new Error("There is no record to answer for.")
      if (me.census.some((entry) => entry.year === "2026/27" && entry.answer))
        throw new Error("Census already answered.")
      me.census = me.census.filter((entry) => entry.year !== "2026/27")
      me.census.unshift({
        year: "2026/27",
        answer: input.answer,
        answeredOn: today(),
        source: "dashboard",
        declaredMember: me.member !== null && me.member.status !== "former",
        reminders: 0,
      })
      for (const group of me.admin?.groups ?? []) {
        if (input.answer === "continues" && input.keepGroups.includes(group.chatId)) continue
        const message = `Telegram admin removal pending: ${group.title} (${group.chatId}). HR must remove the admin rights; requested in census 2026/27.`
        me.pendingGroupRemovals ??= []
        if (!me.pendingGroupRemovals.some((item) => item.chatId === group.chatId))
          me.pendingGroupRemovals.push({ chatId: group.chatId, message })
      }
      for (const membership of me.teams)
        if (!membership.endedOn && (input.answer === "leaving" || !input.keepTeams.includes(membership.team)))
          Object.assign(membership, { endedOn: today(), endReason: input.reason || "Census 2026/27" })
      if (input.answer === "leaving" && me.admin)
        Object.assign(me.admin, { status: "former", endedOn: today(), endReason: input.reason })
      Object.assign(me.profile, { course: input.course, year: input.year, campus: input.campus })
      log(me, fullName(me), `answered the 2026/27 census: ${input.answer === "continues" ? "continues" : "leaving"}`)
    },
    requestCorrection: async (input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (me) log(me, fullName(me), `asked HR to correct ${input.field.toLowerCase()}`)
    },
    revokePhotoConsent: async () => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me?.consents.photo || me.consents.photo.status !== "granted")
        throw new Error("There is no photo and video consent to revoke.")
      me.consents.photo = { status: "revoked", on: today() }
      log(me, fullName(me), "revoked the photo and video consent")
    },
  }
}
