import { createHash } from "node:crypto"

import type { PeopleApi, PeopleViewer } from "./people.api.server"
import {
  type Account,
  type Assignment,
  type MyArea,
  type PersonRecord,
  type PersonRow,
  TEAM_IDS,
  TEAMS,
  type TeamId,
  type TeamRole,
} from "./people.contract"
import {
  addDays,
  BOUND_TEAM_ROLES,
  buildPeopleStore,
  type PeopleStore,
  REFUSAL,
  REFUSING_ACCOUNTS,
  type StoredAssignment,
  type StoredPerson,
} from "./people.fixtures.server"

/**
 * Agent mode's stand-in for the backend's `people.*` procedures, over `people.fixtures.server.ts`. State lives for the
 * dev server's lifetime, so mutations show up on reload. It follows the backend's rules where a page depends on them:
 * contacts and notes only with `people:read`; `people:write` for admins and team members, `people:appoint` for Leads
 * and Capo Admins, a Lead for their team's members; nobody gives themselves a role, though anyone may give one up.
 * Fake Auth confirms a change to a linked record a few seconds after it is sent, and refuses every change for
 * `REFUSING_ACCOUNTS`.
 */

let store: PeopleStore | null = null
/** The record the agent user linked through an invite link, which replaces `AGENT_PERSON`. */
let invitedId: string | null = null
/** How long fake Auth takes to confirm a change. */
const AUTH_DELAY = 4000

function data() {
  store ??= buildPeopleStore()
  settle(store)
  return store
}

/**
 * Fake Auth answers: changes sent long enough ago are confirmed. As in the backend, a confirmed end of a Capo Admin
 * role leaves their admins without a Capo Admin of reference.
 */
function settle(current: PeopleStore) {
  const now = Date.now()
  for (const person of current.people)
    for (const assignment of person.assignments)
      if (assignment.status === "sent" && assignment.settlesAt !== null && assignment.settlesAt <= now) {
        Object.assign(assignment, { status: "applied", settlesAt: null })
        log(person, "system", "PoliNetwork Auth confirmed the change")
        if (assignment.kind === "capo" && assignment.change === "end") clearCapoReferences(current, person, "system")
      }
}

/** Once a Capo Admin's role has ended, the admins who had them as reference have none. */
function clearCapoReferences(current: PeopleStore, capo: StoredPerson, actor: string) {
  for (const other of current.people) {
    const admin = other.assignments.find((a) => a.endedOn === null && a.kind === "admin")
    if (admin?.capoOfReference?.id !== capo.id) continue
    admin.capoOfReference = null
    log(other, actor, `Their Capo Admin of reference, ${capo.id}, ended`)
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fullName(person: Pick<StoredPerson, "firstName" | "lastName">) {
  return `${person.firstName} ${person.lastName}`
}

function ref(person: StoredPerson) {
  return { id: person.id, name: fullName(person) }
}

function find(id: string) {
  const person = data().byId.get(id)
  if (!person) throw new Error("This person no longer exists.")
  return person
}

function log(person: StoredPerson, actor: string, text: string) {
  person.activity.unshift({ actor, text, at: new Date().toISOString() })
}

function touch(person: StoredPerson, actor: string) {
  person.updatedBy = actor
  person.updatedAt = new Date().toISOString()
}

function require(viewer: PeopleViewer, permission: string) {
  if (!viewer.permissions.includes(permission)) throw new Error("UNAUTHORIZED")
}

/**
 * An invite link's token. Agent mode derives it from the record and the send date, so links survive a dev server
 * restart; the backend issues random tokens and stores them hashed.
 */
function inviteToken(personId: string, sentOn: string) {
  return createHash("sha256").update(`people-invite:${personId}:${sentOn}`).digest("base64url")
}

function current(person: StoredPerson, kind: Assignment["kind"], team?: TeamId) {
  return person.assignments.find(
    (a) => a.endedOn === null && a.kind === kind && (team === undefined || a.team === team)
  )
}

/** Current and in effect, as the backend's `confirmed`: not ended, and not a start still waiting for Auth. */
function confirmed(assignment: Assignment) {
  return assignment.endedOn === null && !(assignment.change === "start" && assignment.status === "sent")
}

/** The current assignment of a kind (and team) when it is in effect. */
function confirmedOf(person: StoredPerson, kind: Assignment["kind"], team?: TeamId) {
  const assignment = current(person, kind, team)
  return assignment && confirmed(assignment) ? assignment : undefined
}

function leadsOf(person: StoredPerson | null): TeamId[] {
  if (!person) return []
  return person.assignments.flatMap((a) =>
    a.kind === "team" && a.teamRole === "lead" && confirmed(a) && a.team ? [a.team] : []
  )
}

function account(person: StoredPerson): Account {
  if (person.accountSub)
    return {
      status: "linked",
      sub: person.accountSub,
      method: person.linkMethod ?? "manual",
      linkedOn: person.linkedOn,
      linkedBy: person.linkedBy,
    }
  if (person.invite) return { status: "invite", ...person.invite }
  return { status: "none" }
}

/** A role Auth binds to People: `admin`, `capo`, or `team:<team>:<role>`. */
type Binding = { kind: "admin" } | { kind: "capo" } | { kind: "team"; team: TeamId; role: TeamRole }

function bindingOf(assignment: Assignment): Binding {
  if (assignment.kind === "team" && assignment.team && assignment.teamRole)
    return { kind: "team", team: assignment.team, role: assignment.teamRole }
  return assignment.kind === "capo" ? { kind: "capo" } : { kind: "admin" }
}

function assignmentView({ settlesAt, ...assignment }: StoredAssignment): Assignment {
  void settlesAt
  return assignment
}

export function fakePeopleApi(viewer: PeopleViewer): PeopleApi {
  const canRead = viewer.permissions.includes("people:read")
  /** The record the signed-in person acts as: the one an invite linked, or `AGENT_PERSON`. */
  const mine = () => {
    if (invitedId) return data().byId.get(invitedId) ?? null
    if (!viewer.personId || viewer.personId === "none") return null
    const person = data().byId.get(viewer.personId) ?? null
    return person?.accountSub ? person : null
  }
  const sub = () => mine()?.accountSub ?? "sub-agent"
  const leads = (team: TeamId) => viewer.permissions.includes("people:self") && leadsOf(mine()).includes(team)

  function row(person: StoredPerson, scopedContacts = false): PersonRow {
    const own = person.accountSub !== null && person.accountSub === sub()
    const contacts = own || canRead || scopedContacts
    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      contactEmail: contacts ? person.contactEmail : null,
      phone: contacts ? person.phone : null,
      telegramUsername: person.telegramUsername,
      account: own || canRead ? account(person) : { status: "none" },
      assignments: person.assignments.map(assignmentView),
    }
  }

  function record(person: StoredPerson): PersonRecord {
    return {
      ...row(person),
      notes: canRead ? person.notes : null,
      activity: canRead ? [...person.activity].sort((a, b) => (a.at < b.at ? 1 : -1)) : [],
      createdBy: person.createdBy,
      createdAt: person.createdAt,
      updatedBy: person.updatedBy,
      updatedAt: person.updatedAt,
    }
  }

  /**
   * The same gate as the backend's `rules.ts`, for the bindings agent mode knows. Nobody gives themselves a role, but
   * giving one up is always allowed; a role that isn't bound can still be ended.
   */
  function authorize(person: StoredPerson, binding: Binding, action: "assign" | "unassign") {
    if (action === "assign" && binding.kind === "team" && !BOUND_TEAM_ROLES[binding.team][binding.role])
      throw new Error(
        `No role is bound to team:${binding.team}:${binding.role} in PoliNetwork Auth, so it can't be assigned.`
      )
    const own = person.accountSub !== null && person.accountSub === sub()
    if (own && action === "assign") throw new Error("Nobody can give themselves a role.")
    const appointment = binding.kind === "capo" || (binding.kind === "team" && binding.role === "lead")
    if (own) {
      // Giving up one's own role.
    } else if (appointment) require(viewer, "people:appoint")
    else if (!viewer.permissions.includes("people:write") && !(binding.kind === "team" && leads(binding.team)))
      throw new Error("UNAUTHORIZED")
    if (person.accountSub && person.assignments.some((a) => a.status === "sent"))
      throw new Error("A change for this person is waiting for PoliNetwork Auth: try again once it answers.")
  }

  /** A change to the record's roles: pending while it isn't linked, sent to fake Auth once it is. */
  function push(person: StoredPerson, assignment: StoredAssignment) {
    if (!person.accountSub) {
      assignment.status = "pending"
      return
    }
    if (REFUSING_ACCOUNTS.has(person.accountSub)) {
      if (assignment.change === "start")
        Object.assign(assignment, { endedOn: today(), endReason: "Refused by PoliNetwork Auth" })
      else Object.assign(assignment, { endedOn: null, endReason: null })
      Object.assign(assignment, { status: "refused", refusal: REFUSAL })
      log(person, sub(), `PoliNetwork Auth refused: ${REFUSAL}`)
      throw new Error(REFUSAL)
    }
    Object.assign(assignment, { status: "sent", refusal: null, settlesAt: Date.now() + AUTH_DELAY })
  }

  function start(person: StoredPerson, fields: Partial<StoredAssignment> & Pick<Assignment, "kind" | "since">) {
    if (fields.since > today()) throw new Error("Start date is in the future")
    const assignment: StoredAssignment = {
      id: `A-${String(data().nextAssignment++).padStart(4, "0")}`,
      team: null,
      teamRole: null,
      capoScope: null,
      capoOfReference: null,
      fields: {},
      endedOn: null,
      endReason: null,
      assignedBy: sub(),
      change: "start",
      status: "pending",
      refusal: null,
      settlesAt: null,
      ...fields,
    }
    person.assignments.push(assignment)
    touch(person, sub())
    return assignment
  }

  function end(person: StoredPerson, assignment: StoredAssignment, reason: string) {
    Object.assign(assignment, { endedOn: today(), endReason: reason, change: "end" })
    touch(person, sub())
  }

  function capoRef(capoId: string | null, personId: string) {
    if (!capoId) return null
    const capo = find(capoId)
    if (capo.id === personId || !current(capo, "capo")) throw new Error("Choose a current Capo Admin")
    return ref(capo)
  }

  function teamAccess(team: TeamId, write: boolean) {
    if (viewer.permissions.includes(write ? "people:write" : "people:read")) return
    if (!leads(team)) throw new Error("You do not lead this team")
  }

  function inviteAccess(person: StoredPerson) {
    if (viewer.permissions.includes("people:write")) return
    const teams = person.assignments.flatMap((a) => (a.kind === "team" && a.endedOn === null && a.team ? [a.team] : []))
    if (!teams.some(leads))
      throw new Error("Inviting needs people:write and admin:access, or leading one of the person's teams")
  }

  function inviteFor(token: string) {
    const person = data().people.find(
      (candidate) =>
        candidate.invite &&
        !candidate.accountSub &&
        inviteToken(candidate.id, candidate.invite.sentOn) === token &&
        candidate.invite.expiresOn >= today()
    )
    if (!person) throw new Error("This invite link is no longer valid: ask for a new one")
    return person
  }

  /** Links the account and sends the pending assignments to fake Auth. */
  function link(person: StoredPerson, accountSub: string, actor: string, method: "invite" | "manual", how: string) {
    if (person.accountSub) throw new Error("Unlink the existing account first")
    const other = data().people.find((candidate) => candidate.accountSub === accountSub)
    if (other) throw new Error(`This account is already linked to ${other.id}`)
    Object.assign(person, { accountSub, linkMethod: method, linkedOn: today(), linkedBy: actor, invite: null })
    touch(person, actor)
    log(person, actor, `Linked account ${accountSub} (${method === "invite" ? "email invite" : "by hand"}): ${how}`)
    for (const assignment of person.assignments)
      if (assignment.endedOn === null && assignment.status === "pending")
        Object.assign(assignment, { status: "sent", settlesAt: Date.now() + AUTH_DELAY })
  }

  return {
    listPeople: async () => {
      require(viewer, "people:read")
      return data().people.map((person) => row(person))
    },
    getPerson: async (id) => {
      require(viewer, "people:read")
      return record(find(id))
    },
    createPerson: async (input) => {
      require(viewer, "people:write")
      const { people, byId } = data()
      const id = `P-${String(people.length + 1).padStart(4, "0")}`
      const now = new Date().toISOString()
      const person: StoredPerson = {
        id,
        firstName: input.firstName,
        lastName: input.lastName,
        contactEmail: input.contactEmail || null,
        phone: input.phone || null,
        telegramUsername: input.telegramUsername || null,
        notes: null,
        accountSub: null,
        linkMethod: null,
        linkedOn: null,
        linkedBy: null,
        invite: null,
        assignments: [],
        activity: [],
        createdBy: sub(),
        createdAt: now,
        updatedBy: sub(),
        updatedAt: now,
      }
      log(person, sub(), "Created the record")
      people.push(person)
      byId.set(id, person)
      return { id }
    },
    updatePerson: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      Object.assign(person, {
        firstName: input.firstName,
        lastName: input.lastName,
        contactEmail: input.contactEmail || null,
        phone: input.phone || null,
        telegramUsername: input.telegramUsername || null,
      })
      touch(person, sub())
      log(person, sub(), "Updated the record")
    },
    setNote: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      person.notes = input.note || null
      touch(person, sub())
      log(person, sub(), "Updated the HR note")
    },

    listAdmins: async () => {
      require(viewer, "people:read")
      return data().people.flatMap((person) => {
        const admin = current(person, "admin")
        if (!admin) return []
        const capo = current(person, "capo")
        return [{ person: row(person), admin: assignmentView(admin), capo: capo ? assignmentView(capo) : null }]
      })
    },
    assignAdmin: async (input) => {
      const person = find(input.personId)
      authorize(person, { kind: "admin" }, "assign")
      if (current(person, "admin")) throw new Error("Already an admin")
      const assignment = start(person, {
        kind: "admin",
        since: input.since,
        capoOfReference: capoRef(input.capoId, person.id),
      })
      log(person, sub(), "Made admin")
      push(person, assignment)
    },
    endAdmin: async (input) => {
      const person = find(input.personId)
      const assignment = current(person, "admin")
      if (!assignment) throw new Error("Not a current admin")
      authorize(person, { kind: "admin" }, "unassign")
      if (current(person, "capo")) throw new Error("End their Capo Admin appointment first")
      end(person, assignment, input.reason)
      log(person, sub(), `Ended admin: ${input.reason}`)
      push(person, assignment)
    },
    setCapoOfReference: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      const assignment = current(person, "admin")
      if (!assignment) throw new Error("Not a current admin")
      assignment.capoOfReference = capoRef(input.capoId, person.id)
      touch(person, sub())
      log(
        person,
        sub(),
        input.capoId ? `Capo Admin of reference: ${input.capoId}` : "Cleared the Capo Admin of reference"
      )
    },

    listCapos: async () => {
      require(viewer, "people:read")
      return data().people.flatMap((person) => {
        const capo = current(person, "capo")
        if (!capo) return []
        const admins = data().people.filter((other) => current(other, "admin")?.capoOfReference?.id === person.id)
        return [{ person: row(person), capo: assignmentView(capo), admins: admins.map(ref) }]
      })
    },
    appointCapo: async (input) => {
      const person = find(input.personId)
      authorize(person, { kind: "capo" }, "assign")
      if (!current(person, "admin")) throw new Error("Make them an admin first")
      if (current(person, "capo")) throw new Error("Already a Capo Admin")
      const assignment = start(person, { kind: "capo", since: input.since, capoScope: input.scope })
      log(person, sub(), `Appointed Capo Admin for ${input.scope}`)
      push(person, assignment)
    },
    setCapoScope: async (input) => {
      require(viewer, "people:appoint")
      const person = find(input.personId)
      const assignment = current(person, "capo")
      if (!assignment) throw new Error("Not a current Capo Admin")
      assignment.capoScope = input.scope
      touch(person, sub())
      log(person, sub(), `Capo Admin scope: ${input.scope}`)
    },
    endCapo: async (input) => {
      const person = find(input.personId)
      const assignment = current(person, "capo")
      if (!assignment) throw new Error("Not a current Capo Admin")
      authorize(person, { kind: "capo" }, "unassign")
      end(person, assignment, input.reason)
      // For a linked record, once Auth confirms (`settle`): a refusal keeps them Capo Admin of the same admins.
      if (!person.accountSub) clearCapoReferences(data(), person, sub())
      log(person, sub(), `Ended Capo Admin: ${input.reason}`)
      push(person, assignment)
    },

    listTeams: async () => {
      const allowed = TEAM_IDS.filter((team) => canRead || leads(team))
      if (!allowed.length) throw new Error("UNAUTHORIZED")
      return allowed.map((id) => {
        const members = data().people.filter((person) =>
          person.assignments.some((a) => a.team === id && (canRead || confirmed(a)))
        )
        const lead = members.find((person) => leadsOf(person).includes(id))
        return {
          id,
          name: TEAMS[id].name,
          assignable: BOUND_TEAM_ROLES[id],
          lead: lead ? ref(lead) : null,
          members: members.map((person) => {
            const result = row(person, true)
            if (!canRead) result.assignments = result.assignments.filter((a) => a.team === id && a.endedOn === null)
            return result
          }),
        }
      })
    },
    listTeamCandidates: async (input) => {
      teamAccess(input.teamId, false)
      return data()
        .people.filter((person) => !current(person, "team", input.teamId))
        .map(ref)
    },
    addTeamMember: async (input) => {
      const person = find(input.personId)
      authorize(person, { kind: "team", team: input.teamId, role: input.role }, "assign")
      if (current(person, "team", input.teamId)) throw new Error("Already in this team")
      if (
        input.role === "lead" &&
        data().people.some((other) => current(other, "team", input.teamId)?.teamRole === "lead")
      )
        throw new Error("End the existing Lead appointment first")
      const assignment = start(person, {
        kind: "team",
        team: input.teamId,
        teamRole: input.role,
        since: input.since,
        fields: input.fields,
      })
      log(person, sub(), `Joined ${input.teamId} as ${input.role}`)
      push(person, assignment)
    },
    updateTeamFields: async (input) => {
      teamAccess(input.teamId, true)
      const person = find(input.personId)
      const assignment = current(person, "team", input.teamId)
      if (!assignment) throw new Error("Not in this team")
      assignment.fields = input.fields
      touch(person, sub())
      log(person, sub(), `Updated ${input.teamId} fields`)
    },
    endTeamMembership: async (input) => {
      const person = find(input.personId)
      const assignment = current(person, "team", input.teamId)
      if (!assignment?.teamRole) throw new Error("Not in this team")
      authorize(person, { kind: "team", team: input.teamId, role: assignment.teamRole }, "unassign")
      end(person, assignment, input.reason)
      log(person, sub(), `Left ${input.teamId}: ${input.reason}`)
      push(person, assignment)
    },

    listInvites: async () => {
      require(viewer, "people:read")
      return data().people.flatMap((person) =>
        person.invite && !person.accountSub ? [{ personId: person.id, name: fullName(person), ...person.invite }] : []
      )
    },
    listRecentLinks: async () => {
      require(viewer, "people:read")
      const since = addDays(today(), -30)
      const { people, directory } = data()
      return people
        .filter((person) => person.accountSub && person.linkedOn && person.linkedOn >= since)
        .sort((a, b) => ((a.linkedOn ?? "") < (b.linkedOn ?? "") ? 1 : -1))
        .map((person) => ({
          person: ref(person),
          sub: person.accountSub ?? "",
          email: directory.find((entry) => entry.sub === person.accountSub)?.email ?? null,
          method: person.linkMethod ?? "manual",
          linkedOn: person.linkedOn ?? today(),
          linkedBy: person.linkedBy,
        }))
    },
    sendInvite: async (input) => {
      const person = find(input.personId)
      inviteAccess(person)
      if (person.accountSub || !person.contactEmail) throw new Error("Account already linked or contact email missing")
      const sentOn = today()
      person.invite = { email: person.contactEmail, sentOn, expiresOn: addDays(sentOn, 14), sentBy: sub() }
      log(person, sub(), "Queued an account invite")
      console.info(`[agent mode] Invite link for ${person.id}: /people/invite?token=${inviteToken(person.id, sentOn)}`)
    },
    revokeInvite: async (input) => {
      const person = find(input.personId)
      inviteAccess(person)
      if (!person.invite) throw new Error("No open invite")
      person.invite = null
      log(person, sub(), "Revoked the account invite")
    },
    searchAccounts: async (input) => {
      require(viewer, "people:link")
      const query = input.query.toLowerCase()
      const { directory, people } = data()
      return directory
        .filter((entry) => !query || `${entry.name} ${entry.email} ${entry.sub}`.toLowerCase().includes(query))
        .slice(0, 100)
        .map((entry) => {
          const linked = people.find((person) => person.accountSub === entry.sub)
          return { id: entry.sub, name: entry.name, email: entry.email, linkedTo: linked ? ref(linked) : null }
        })
    },
    linkAccount: async (input) => {
      require(viewer, "people:link")
      const entry = data().directory.find((candidate) => candidate.sub === input.accountId)
      if (!entry) throw new Error("IdP account not found")
      if (entry.sub === sub()) throw new Error("Ask someone else to link your own account")
      link(find(input.personId), entry.sub, sub(), "manual", input.reason)
    },
    unlinkAccount: async (input) => {
      require(viewer, "people:link")
      const person = find(input.personId)
      if (!person.accountSub) throw new Error("Account not linked")
      if (person.assignments.some((a) => a.status === "sent"))
        throw new Error("A change for this person is waiting for PoliNetwork Auth: try again once it answers.")
      for (const assignment of person.assignments)
        if (assignment.endedOn === null) {
          authorize(person, bindingOf(assignment), "unassign")
        }
      // Fake Auth takes the roles back at once; the assignments wait for the next link.
      log(person, sub(), `Unlinked account ${person.accountSub}: ${input.reason}`)
      for (const assignment of person.assignments)
        if (assignment.endedOn === null)
          Object.assign(assignment, { status: "pending", change: "start", refusal: null, settlesAt: null })
      Object.assign(person, { accountSub: null, linkMethod: null, linkedOn: null, linkedBy: null })
      touch(person, sub())
    },

    getCapoArea: async () => {
      require(viewer, "people:self")
      const person = mine()
      const scope = person ? confirmedOf(person, "capo")?.capoScope : null
      if (!person || !scope) throw new Error("UNAUTHORIZED")
      return {
        scope,
        admins: data()
          .people.filter((other) => confirmedOf(other, "admin")?.capoOfReference?.id === person.id)
          .map((other) => ({ ...row(other, true), contactEmail: null, phone: null })),
      }
    },
    getMyRoles: async () => {
      require(viewer, "people:self")
      const person = mine()
      return { capoScope: (person && confirmedOf(person, "capo")?.capoScope) ?? null, leads: leadsOf(person) }
    },
    getMyArea: async (): Promise<MyArea> => {
      require(viewer, "people:self")
      const person = mine()
      if (!person) return { state: "none" }
      const teams = person.assignments.flatMap((a) => (a.kind === "team" && confirmed(a) && a.team ? [a.team] : []))
      const contacts: Extract<MyArea, { state: "linked" }>["contacts"] = []
      const capoId = confirmedOf(person, "admin")?.capoOfReference?.id
      const capo = capoId ? data().byId.get(capoId) : undefined
      if (capo && confirmedOf(capo, "capo"))
        contacts.push({ role: "capo", name: fullName(capo), telegram: capo.telegramUsername, team: null })
      for (const other of data().people) {
        for (const team of leadsOf(other).filter((led) => teams.includes(led)))
          contacts.push({ role: "lead", name: fullName(other), telegram: other.telegramUsername, team })
        if (confirmedOf(other, "team", "hr"))
          contacts.push({ role: "hr", name: fullName(other), telegram: other.telegramUsername, team: "hr" })
      }
      const [team] = teams
      return {
        state: "linked",
        person: record(person),
        contacts,
        roster: team
          ? {
              team,
              members: data().people.flatMap((other) => {
                const assignment = confirmedOf(other, "team", team)
                return assignment?.teamRole
                  ? [{ ...ref(other), role: assignment.teamRole, telegram: other.telegramUsername }]
                  : []
              }),
            }
          : null,
      }
    },
    previewInvite: async (input) => {
      const person = inviteFor(input.token)
      return { personId: person.id, name: fullName(person), expiresOn: person.invite?.expiresOn ?? today() }
    },
    acceptInvite: async (input) => {
      const person = inviteFor(input.token)
      // Agent mode accepts as a fresh account; from then on it acts as the invited record.
      link(person, "sub-agent", "sub-agent", "invite", "Accepted the email invite")
      invitedId = person.id
    },
  }
}
