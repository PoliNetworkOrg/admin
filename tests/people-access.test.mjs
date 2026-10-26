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
const { FAMILIES } = await import("../src/features/people/people.fixtures.server.ts")

const ALL = [
  "people:read",
  "people:write",
  "people:members:read",
  "people:members:write",
  "people:appoint",
  "people:self",
]
const SELF = ["people:self"]
const hr = fakePeopleApi({ permissions: ALL, personId: null })
const records = await Promise.all((await hr.listPeople()).map((person) => hr.getPerson(person.id)))

const activeLead = (person) => person.teams.find((team) => team.role === "lead" && !team.endedOn)
const plain = records.find((person) => !person.admin?.capoScope && !activeLead(person))
const lead = records.find(activeLead)
const teamId = activeLead(lead).team
const teammate = records.find(
  (person) => person.id !== lead.id && person.teams.some((team) => team.team === teamId && !team.endedOn)
)
const capoOf = (group) =>
  records.find((person) => {
    const scope = person.admin?.status === "active" ? person.admin.capoScope : null
    return scope && Object.values(FAMILIES).some((family) => family.scope === scope && family.groups.includes(group))
  })
const otherCapo = (group) =>
  records.find((person) => person.admin?.status === "active" && person.admin.capoScope && person !== capoOf(group))

const unauthorized = { message: "UNAUTHORIZED" }

void test("join requests are approved or declined only by the Capo Admin of the request's group", async () => {
  const { requests } = await fakePeopleApi({ permissions: SELF, personId: capoOf("Reti Logiche").id }).getCapoArea()
  const request = requests.find((candidate) => candidate.group.title === "Reti Logiche")
  assert.ok(request, "the fixtures hold a request to join Reti Logiche")

  // Anyone else's request reads as already handled, so callers can't tell it exists.
  const hidden = { message: "This request was already handled." }
  for (const personId of [plain.id, "none", otherCapo("Reti Logiche").id]) {
    const viewer = fakePeopleApi({ permissions: SELF, personId })
    await assert.rejects(viewer.approveJoinRequest({ requestId: request.id }), hidden)
    await assert.rejects(viewer.declineJoinRequest({ requestId: request.id }), hidden)
  }
  // Even `people:write` gives no Capo Admin powers.
  await assert.rejects(hr.approveJoinRequest({ requestId: request.id }), hidden)

  await fakePeopleApi({ permissions: SELF, personId: capoOf("Reti Logiche").id }).approveJoinRequest({
    requestId: request.id,
  })
})

void test("an unconfirmed first-sign-in match gets none of the record's powers", async () => {
  const leadMatch = fakePeopleApi({ permissions: SELF, personId: `match:${lead.id}` })
  assert.deepEqual(await leadMatch.getMyRoles(), { capoScope: null, leads: [] })
  await assert.rejects(leadMatch.listTeams(), unauthorized)
  await assert.rejects(leadMatch.listTeamCandidates({ teamId }), unauthorized)
  await assert.rejects(leadMatch.updateTeamFields({ teamId, personId: teammate.id, fields: {} }), unauthorized)
  await assert.rejects(
    leadMatch.endTeamMembership({ teamId, personId: teammate.id, lastDay: "2026-10-14", reason: "Test", note: "" }),
    unauthorized
  )

  const capo = capoOf("Reti Logiche")
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: `match:${capo.id}` }).getCapoArea(), unauthorized)

  const { profile } = lead
  await assert.rejects(
    leadMatch.answerCensus({
      answer: "leaving",
      course: profile.course,
      year: profile.year,
      campus: profile.campus,
      keepGroups: [],
      keepTeams: [],
      reason: "",
      note: "",
    }),
    { message: "There is no record to answer for." }
  )
  assert.deepEqual((await hr.getPerson(lead.id)).census, lead.census)

  const consenting = records.find((person) => person.consents.photo?.status === "granted")
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: `match:${consenting.id}` }).revokePhotoConsent())
  assert.equal((await hr.getPerson(consenting.id)).consents.photo?.status, "granted")

  // Confirming the match makes the record theirs.
  await leadMatch.confirmMatch()
  assert.deepEqual((await leadMatch.getMyRoles()).leads, [teamId])
  assert.ok((await leadMatch.listTeams()).some((team) => team.id === teamId))
})

void test("ending a Lead role needs people:appoint, like giving it", async () => {
  const asLead = fakePeopleApi({ permissions: SELF, personId: lead.id })
  const end = (api, personId) =>
    api.endTeamMembership({ teamId, personId, lastDay: "2026-10-14", reason: "Test", note: "" })

  await assert.rejects(end(asLead, lead.id), unauthorized)
  await assert.rejects(end(fakePeopleApi({ permissions: ["people:write"], personId: null }), lead.id), unauthorized)
  await end(asLead, teammate.id)
  await end(hr, lead.id)
})

void test("the member export keeps every cell as text", async () => {
  const member = records.find((person) => person.member)
  const { profile } = member
  await hr.updatePerson({
    id: member.id,
    firstName: '=HYPERLINK("http://example.invalid","x")',
    lastName: "Rossi",
    personalEmail: "member@example.invalid",
    phone: "",
    telegramUsername: "",
    course: profile.course,
    year: profile.year,
    campus: profile.campus,
  })
  const { csv } = await hr.exportMembers()
  const line = csv.split("\n").find((candidate) => candidate.includes("HYPERLINK"))
  assert.ok(line?.includes(`"'=HYPERLINK(""http://example.invalid"",""x"") Rossi"`), line)
  for (const cell of line.slice(1, -1).split('","')) assert.doesNotMatch(cell, /^[=+\-@\t\r]/)
})

void test("member details need people:members:read, except on the viewer's own record", async () => {
  const member = records.find((person) => person.isMember && person.member)
  assert.ok(member, "the fixtures hold a current member")
  const reader = fakePeopleApi({ permissions: ["people:read"], personId: null })

  const listed = (await reader.listPeople()).find((person) => person.id === member.id)
  assert.equal(listed.member, null)
  assert.equal(listed.isMember, true)
  assert.equal((await reader.getPerson(member.id)).member, null)

  assert.deepEqual((await hr.getPerson(member.id)).member, member.member)
  const self = fakePeopleApi({ permissions: ["people:read", "people:self"], personId: member.id })
  assert.deepEqual((await self.getPerson(member.id)).member, member.member)
})

void test("a census answer that drops a group leaves an admin-removal item, not a Linking review", async () => {
  const admin = records.find(
    (person) =>
      person.admin?.status === "active" &&
      person.admin.groups.length &&
      person.account.status === "linked" &&
      !person.census.some((entry) => entry.year === "2026/27" && entry.answer)
  )
  assert.ok(admin, "the fixtures hold a linked admin who hasn't answered")
  const self = fakePeopleApi({ permissions: SELF, personId: admin.id })
  const { course, campus } = admin.profile
  await self.answerCensus({ answer: "continues", course, year: "1st year MSc", campus, keepGroups: [], keepTeams: [] })
  const kinds = (await hr.getPerson(admin.id)).discrepancies.map((discrepancy) => discrepancy.kind)
  assert.ok(kinds.includes("admin-removal"))
  assert.ok(!kinds.includes("needs-review"))
})

void test("a Lead sees contacts of current team members only", async () => {
  // Earlier tests may end memberships, so pick the team from the current state.
  const inTeam = (person, id) => person.teams.some((membership) => membership.team === id && !membership.endedOn)
  const full = (await hr.listTeams()).find(
    (candidate) => candidate.lead && candidate.members.some((person) => !inTeam(person, candidate.id))
  )
  assert.ok(full, "the fixtures hold a team with a Lead and a former member")
  const [team] = await fakePeopleApi({ permissions: SELF, personId: full.lead.id }).listTeams()
  for (const person of team.members.filter((candidate) => !inTeam(candidate, team.id))) {
    assert.equal(person.profile.phone, null)
    assert.equal(person.profile.personalEmail, null)
  }
  const withPhone = full.members.find(
    (person) => inTeam(person, team.id) && person.id !== full.lead.id && person.profile.phone
  )
  assert.ok(withPhone, "the fixtures hold a current teammate with a phone")
  const activeRow = team.members.find((person) => person.id === withPhone.id)
  assert.equal(activeRow.profile.phone, withPhone.profile.phone)
  assert.equal(activeRow.profile.personalEmail, withPhone.profile.personalEmail)
})

void test("the member register works without people:read and exposes only register fields", async () => {
  const reader = fakePeopleApi({ permissions: ["people:members:read"], personId: "none" })
  const rows = await reader.listMembers()
  assert.ok(rows.some((person) => person.member))
  assert.ok(
    rows.some((person) => !person.member),
    "admission candidates remain available"
  )
  for (const person of rows) {
    assert.deepEqual(Object.keys(person).sort(), ["account", "id", "member", "profile"])
    assert.deepEqual(Object.keys(person.profile).sort(), ["firstName", "lastName", "personalEmail"])
    assert.equal(person.profile.personalEmail, null)
    assert.deepEqual(Object.keys(person.account), ["status"])
  }
  await assert.rejects(reader.listPeople(), unauthorized)
  await assert.rejects(reader.getPerson(rows[0].id), unauthorized)
})

void test("admission cannot overwrite an existing membership or its history", async () => {
  const member = records.find((person) => person.member)
  const before = await hr.getPerson(member.id)
  await assert.rejects(
    hr.createMember({ personId: member.id, number: "9999", admittedOn: "2026-10-18", fee: "paid" }),
    { message: "This person is already registered as a member." }
  )
  assert.deepEqual(await hr.getPerson(member.id), before)
})
