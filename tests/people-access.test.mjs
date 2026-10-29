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

const ALL = ["people:read", "people:write", "people:appoint", "people:self"]
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
const capo = records.find((person) => person.admin?.status === "active" && person.admin.capoScope)

const unauthorized = { message: "UNAUTHORIZED" }

void test("the Capo Admin area lists the admins who have the viewer as Capo Admin of reference", async () => {
  const area = await fakePeopleApi({ permissions: SELF, personId: capo.id }).getCapoArea()
  assert.equal(area.scope, capo.admin.capoScope)
  assert.ok(area.admins.length > 0, "the fixtures give the Capo Admin some admins")
  for (const admin of area.admins) {
    assert.equal(admin.admin?.capoOfReference?.id, capo.id)
    assert.equal(admin.profile.personalEmail, null)
  }
  assert.deepEqual(Object.keys(area).sort(), ["admins", "scope"])
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: plain.id }).getCapoArea(), unauthorized)
  await assert.rejects(fakePeopleApi({ permissions: SELF, personId: "none" }).getCapoArea(), unauthorized)
})

void test("records carry no member, census, fee or Telegram group data", async () => {
  for (const person of records) {
    for (const key of ["member", "isMember", "census", "fees"]) assert.ok(!(key in person), `${person.id} has ${key}`)
    if (person.admin) {
      assert.ok(!("groups" in person.admin), person.id)
      assert.ok(!("requested" in person.admin), person.id)
    }
    assert.notEqual(person.account.status, "review")
  }
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

void test("My area shows the record, or nothing yet for a sign-in without one", async () => {
  const mine = await fakePeopleApi({ permissions: SELF, personId: lead.id }).getMyArea()
  assert.equal(mine.state, "linked")
  assert.deepEqual(Object.keys(mine).sort(), ["contacts", "person", "roster", "state"])
  assert.equal(mine.person.notes, null)
  const none = await fakePeopleApi({ permissions: SELF, personId: "none" }).getMyArea()
  assert.deepEqual(none, { state: "none" })
})
