import { createHash } from "node:crypto"

import type { PeopleApi, PeopleViewer } from "./people.api.server"
import {
  type AccountMatch,
  type CapoArea,
  type Discrepancy,
  type MyArea,
  type PersonRecord,
  type PersonRow,
  TEAM_IDS,
  TEAMS,
  type TeamId,
  type TeamSummary,
} from "./people.contract"
import { addDays, buildPeopleStore, type PeopleStore, type StoredPerson } from "./people.fixtures.server"

/**
 * Agent mode's stand-in for the backend's `people.*` procedures, over `people.fixtures.server.ts`. State lives for the
 * dev server's lifetime, so mutations show up on reload. It enforces the same visibility rules the backend must:
 * contacts and notes only with `people:read`, a Capo Admin's scope, or a Team Lead's team.
 */

let store: PeopleStore | null = null
/** The agent user's own state: the record linked through an invite link, which replaces `AGENT_PERSON`. */
type SelfState = { invitedId: string | null }
const self: SelfState = { invitedId: null }

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
  if (!person.censusTelegram || person.censusTelegram === person.profile.telegramUsername) return []
  return [
    {
      kind: "telegram-mismatch",
      message: `The 2026/27 census says @${person.censusTelegram}, but the record says @${person.profile.telegramUsername ?? "—"}.`,
      suggestedTelegram: person.censusTelegram,
    },
  ]
}

/** The contract row, with contacts kept only when `withContacts`. */
function row(person: StoredPerson, withContacts: boolean): PersonRow {
  return {
    id: person.id,
    profile: {
      ...person.profile,
      personalEmail: withContacts ? person.profile.personalEmail : null,
      phone: withContacts ? person.profile.phone : null,
    },
    admin: person.admin,
    teams: person.teams,
    consents: person.consents,
    account: person.account,
  }
}

function record(person: StoredPerson, viewer: PeopleViewer): PersonRecord {
  const canRead = viewer.permissions.includes("people:read")
  const ownRecord = linkedRecord(viewer)?.id === person.id
  return {
    ...row(person, canRead || ownRecord),
    notes: canRead ? person.notes : null,
    discrepancies: canRead ? discrepancies(person) : [],
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

/** The record the signed-in person acts as: the one an invite linked, or `AGENT_PERSON`. */
function linkedRecord(viewer: PeopleViewer) {
  if (self.invitedId) return data().byId.get(self.invitedId) ?? null
  if (!viewer.personId || viewer.personId === "none") return null
  return data().byId.get(viewer.personId) ?? null
}

/**
 * An invite link's token. Agent mode derives it from the record and the send date, so links survive a dev server
 * restart (to switch `AGENT_PERSON`); the backend issues random tokens and stores them hashed.
 */
function inviteToken(personId: string, sentOn: string) {
  return createHash("sha256").update(`people-invite:${personId}:${sentOn}`).digest("base64url")
}

function leadsOf(person: StoredPerson | null): TeamId[] {
  if (!person) return []
  return person.teams.filter((team) => team.role === "lead" && !team.endedOn).map((team) => team.team)
}

export function fakePeopleApi(viewer: PeopleViewer): PeopleApi {
  const actor = viewerName(viewer)
  return {
    listPeople: async () => {
      require(viewer, "people:read")
      return data().people.map((person) => row(person, true))
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
          personalEmail: input.personalEmail || null,
          phone: input.phone || null,
          telegramUsername: input.telegramUsername || null,
          telegramId: null,
          course: input.course,
          year: input.year,
          campus: input.campus,
          otherAssociations: [],
          studentRepresentative: null,
        },
        admin: input.admin
          ? {
              status: "active",
              since: today(),
              endedOn: null,
              endReason: null,
              availableAsCapo: false,
              capoOfReference: null,
              capoScope: null,
            }
          : null,
        teams: [],
        consents: { privacy: null, photo: null },
        account: { status: "none" },
        notes: null,
        activity: [],
        censusTelegram: null,
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
        personalEmail: input.personalEmail || null,
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
    endAdmin: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("This person isn't an active admin.")
      if (person.admin.capoScope) require(viewer, "people:appoint")
      Object.assign(person.admin, {
        status: "former",
        endedOn: today(),
        endReason: input.reason,
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
            row(person, canRead || person.teams.some((team) => team.team === id && !team.endedOn))
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
      const scope = me?.admin?.status === "active" ? me.admin.capoScope : null
      if (!me || !scope) throw new Error("UNAUTHORIZED")
      const admins = data().people.filter(
        (person) => person.admin?.status === "active" && person.admin.capoOfReference?.id === me.id
      )
      return {
        scope,
        admins: admins.map((person) => ({
          ...row(person, true),
          profile: { ...person.profile, personalEmail: null },
        })),
      } satisfies CapoArea
    },
    getMyRoles: async () => {
      const me = linkedRecord(viewer)
      return { capoScope: me?.admin?.capoScope ?? null, leads: leadsOf(me) }
    },
    getMyArea: async () => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me) return { state: "none" } satisfies MyArea
      const contacts: Extract<MyArea, { state: "linked" }>["contacts"] = []
      const capo = me.admin?.capoOfReference ? data().byId.get(me.admin.capoOfReference.id) : undefined
      if (capo)
        contacts.push({
          role: "capo",
          name: fullName(capo),
          telegram: capo.profile.telegramUsername,
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
            team: membership.team,
          })
      }
      contacts.push({ role: "hr", name: "HR team", telegram: null, team: null })
      const team = me.teams.find((membership) => !membership.endedOn)?.team ?? null
      const roster = team
        ? {
            team,
            members: data()
              .people.flatMap((person) => {
                const membership = person.teams.find((candidate) => candidate.team === team && !candidate.endedOn)
                if (!membership) return []
                return [
                  {
                    id: person.id,
                    name: fullName(person),
                    role: membership.role,
                    telegram: person.profile.telegramUsername,
                  },
                ]
              })
              .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "lead" ? -1 : 1)),
          }
        : null
      return {
        state: "linked",
        person: { ...record(me, { ...viewer, personId: me.id }), notes: null },
        contacts,
        roster,
      } satisfies MyArea
    },
    acceptInvite: async (input) => {
      require(viewer, "people:self")
      if (linkedRecord(viewer)) throw new Error("Your account is already linked to a record.")
      // The token alone identifies the invited record.
      const me = data().people.find(
        (person) =>
          person.account.status === "invite" &&
          person.account.expiresOn >= today() &&
          inviteToken(person.id, person.account.sentOn) === input.token
      )
      if (me?.account.status !== "invite") throw new Error("This invitation has expired or was revoked.")
      self.invitedId = me.id
      me.account = {
        status: "linked",
        email: me.account.email,
        via: "Email",
        linkedOn: today(),
        how: "Accepted the email invitation",
      }
    },
  }
}
