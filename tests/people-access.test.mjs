import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

// Run the agent-mode People API under Node, resolving the same extensionless source imports as Vite.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { fakePeopleApi } = await import("../src/features/people/people.fake.server.ts")

const ALL = ["people:read", "people:write", "people:appoint", "people:link", "people:self"]
const SELF = ["people:self"]
const hr = fakePeopleApi({ permissions: ALL, personId: "P-0002" })
const records = await Promise.all((await hr.listPeople()).map((person) => hr.getPerson(person.id)))

const current = (person, kind) => person.assignments.find((a) => a.kind === kind && a.endedOn === null)
const leadOf = (person) => person.assignments.find((a) => a.teamRole === "lead" && a.endedOn === null)
const capo = records.find((person) => current(person, "capo") && person.account.status === "linked")
const plain = records.find(
  (person) => !current(person, "capo") && !leadOf(person) && person.account.status === "linked"
)
const lead = records.find((person) => leadOf(person) && person.account.status === "linked" && person.id !== "P-0002")
const teamId = leadOf(lead).team
const teammate = records.find(
  (person) =>
    person.id !== lead.id &&
    person.assignments.some((a) => a.team === teamId && a.endedOn === null && a.teamRole === "member") &&
    !person.assignments.some((a) => a.status === "sent")
)

const unauthorized = { message: "UNAUTHORIZED" }

void test("agent mode covers linked and unlinked records and every assignment status", () => {
  const accounts = new Set(records.map((person) => person.account.status))
  assert.deepEqual([...accounts].sort(), ["invite", "linked", "none"])
  const statuses = new Set(records.flatMap((person) => person.assignments.map((a) => a.status)))
  assert.deepEqual([...statuses].sort(), ["applied", "pending", "refused", "sent"])
  for (const person of records)
    for (const assignment of person.assignments) {
      // Pending means not linked: Auth knows nothing of the record yet.
      if (assignment.status === "pending" && assignment.endedOn === null)
        assert.notEqual(person.account.status, "linked", `${person.id} ${assignment.id}`)
      if (assignment.status === "refused") assert.ok(assignment.refusal, `${person.id} ${assignment.id}`)
    }
  const today = new Date().toISOString().slice(0, 10)
  const invites = records.flatMap((person) => (person.account.status === "invite" ? [person.account] : []))
  assert.ok(
    invites.some((invite) => invite.expiresOn < today),
    "an expired invite"
  )
  assert.ok(
    invites.some((invite) => invite.expiresOn >= today),
    "an open invite"
  )
})

void test("the Capo Admin area lists the admins who have the viewer as Capo Admin of reference, without contacts", async () => {
  const area = await fakePeopleApi({ permissions: SELF, personId: capo.id }).getCapoArea()
  assert.equal(area.scope, current(capo, "capo").capoScope)
  assert.ok(area.admins.length > 0, "the fixtures give the Capo Admin some admins")
  for (const admin of area.admins) {
    assert.equal(current(admin, "admin")?.capoOfReference?.id, capo.id)
    assert.equal(admin.contactEmail, null)
    assert.equal(admin.phone, null)
  }
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: plain.id }).getCapoArea(), unauthorized)
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: "none" }).getCapoArea(), unauthorized)
})

void test("a Lead manages their team's members, but appointing or ending a Lead needs people:appoint", async () => {
  const asLead = fakePeopleApi({ permissions: SELF, personId: lead.id })
  const end = (api, personId) => api.endTeamMembership({ teamId, personId, reason: "Test" })

  // Nobody gives themselves a role, and a Lead is no Lead of Leads.
  const otherTeam = ["it", "hr", "design", "intl"].find((team) => team !== teamId)
  await assert.rejects(
    asLead.addTeamMember({ teamId: otherTeam, personId: lead.id, role: "member", since: "2026-01-01", fields: {} }),
    /give themselves/
  )
  await assert.rejects(end(fakePeopleApi({ permissions: ["people:write"], personId: null }), lead.id), unauthorized)
  await end(asLead, teammate.id)
  const after = await hr.getPerson(teammate.id)
  const ended = after.assignments.find((a) => a.team === teamId && a.change === "end")
  assert.ok(ended?.endedOn, "the membership ended")
  assert.equal(ended.status, after.account.status === "linked" ? "sent" : "pending")
  // Giving up one's own role is always allowed, as in Auth.
  await end(asLead, lead.id)
  assert.ok(leadOf(await hr.getPerson(lead.id)) === undefined, "the Lead role ended")
})

void test("a Lead's team lists the memberships in effect, pending ones of unlinked records included", async () => {
  // A team whose Lead is linked and has a member whose record isn't: P-0030 leads Design & Marketing.
  const designLead = records.find((person) => leadOf(person)?.team === "design")
  const [design] = await fakePeopleApi({ permissions: SELF, personId: designLead.id }).listTeams()
  assert.equal(design.id, "design")
  const pending = records.find((person) =>
    person.assignments.some((a) => a.team === "design" && a.endedOn === null && a.status === "pending")
  )
  assert.ok(pending, "the fixtures have an unlinked Design & Marketing member")
  assert.ok(design.members.some((member) => member.id === pending.id))
  for (const member of design.members) {
    assert.ok(member.assignments.length > 0, member.id)
    assert.ok(
      member.assignments.every((a) => a.team === "design" && a.endedOn === null),
      member.id
    )
  }
})

void test("Auth's refusal reaches the record and the caller", async () => {
  const refusing = records.find((person) => person.account.status === "linked" && person.account.sub === "sub-0012")
  await assert.rejects(
    hr.addTeamMember({ teamId: "intl", personId: refusing.id, role: "member", since: "2026-01-01", fields: {} }),
    /permissions/
  )
  const after = await hr.getPerson(refusing.id)
  const refused = after.assignments.find((a) => a.team === "intl")
  assert.equal(refused.status, "refused")
  assert.ok(refused.endedOn, "a refused start never took effect")
})

void test("an unlinked record's new roles wait as pending, and go to Auth when it is linked", async () => {
  const { id } = await hr.createPerson({
    firstName: "Nuova",
    lastName: "Persona",
    contactEmail: "",
    phone: "",
    telegramUsername: "",
  })
  await hr.assignAdmin({ personId: id, since: "2026-01-01", capoId: null })
  assert.equal(current(await hr.getPerson(id), "admin").status, "pending")
  await hr.linkAccount({ personId: id, accountId: "sub-0105", reason: "Checked in person" })
  const linked = await hr.getPerson(id)
  assert.equal(linked.account.status, "linked")
  assert.equal(current(linked, "admin").status, "sent")
  // Roles waiting for Auth block another change, and the account can't be linked twice.
  await assert.rejects(hr.unlinkAccount({ personId: id, reason: "Test" }), /waiting/)
  await assert.rejects(hr.linkAccount({ personId: "P-0040", accountId: "sub-0105", reason: "Test" }), /already linked/)
})

void test("a team without a bound Lead role can't get a Lead, and only bound roles are offered", async () => {
  const teams = await hr.listTeams()
  const events = teams.find((team) => team.id === "events")
  assert.equal(events.assignable.lead, false)
  await assert.rejects(
    hr.addTeamMember({ teamId: "events", personId: plain.id, role: "lead", since: "2026-01-01", fields: {} }),
    /No role is bound/
  )
})

void test("linking by hand and unlinking need people:link", async () => {
  const writer = fakePeopleApi({ permissions: ["people:read", "people:write"], personId: null })
  await assert.rejects(writer.searchAccounts({ query: "" }), unauthorized)
  await assert.rejects(writer.unlinkAccount({ personId: plain.id, reason: "Test" }), unauthorized)
  assert.ok((await hr.searchAccounts({ query: "gmail" })).length > 0)
})

void test("My area shows the record, or nothing yet for a sign-in without one", async () => {
  const mine = await fakePeopleApi({ permissions: SELF, personId: capo.id }).getMyArea()
  assert.equal(mine.state, "linked")
  assert.equal(mine.person.id, capo.id)
  assert.deepEqual(mine.person.activity, [], "the activity needs people:read")
  assert.equal(mine.person.notes, null)
  assert.deepEqual(await fakePeopleApi({ permissions: SELF, personId: "none" }).getMyArea(), { state: "none" })
  await assert.rejects(fakePeopleApi({ permissions: [], personId: capo.id }).getMyArea(), unauthorized)
})

// Last: accepting an invite makes agent mode act as the invited record from then on.
void test("an account with no permissions can preview and accept an invite, which works once", async () => {
  const { createHash } = await import("node:crypto")
  const invited = records.find((person) => person.account.status === "none" && person.contactEmail)
  await hr.sendInvite({ personId: invited.id })
  const { account } = await hr.getPerson(invited.id)
  assert.equal(account.status, "invite")
  const token = createHash("sha256").update(`people-invite:${invited.id}:${account.sentOn}`).digest("base64url")
  const nobody = fakePeopleApi({ permissions: [], personId: "none" })
  const preview = await nobody.previewInvite({ token })
  assert.equal(preview.personId, invited.id)
  await nobody.acceptInvite({ token })
  const linked = await hr.getPerson(invited.id)
  assert.equal(linked.account.status, "linked")
  assert.equal(linked.account.method, "invite")
  assert.ok(linked.assignments.filter((a) => a.endedOn === null).every((a) => a.status === "sent"))
  await assert.rejects(nobody.previewInvite({ token }), /no longer valid/)
  assert.ok((await hr.listRecentLinks()).some((link) => link.person.id === invited.id && link.method === "invite"))
})
