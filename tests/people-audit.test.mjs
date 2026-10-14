import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

import { dateOnlyValue, parseDateOnly } from "../src/lib/date-only.ts"
import { availablePermissions, canEnterDashboard, PERMISSIONS } from "../src/server/permissions.ts"
import { resolvePeopleYear } from "../src/server/runtime-env.ts"

// Run the actual server fixtures and navigation under Node, resolving the same source imports as Vite.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const url = new URL(`../src/${specifier.slice(2)}`, import.meta.url)
      if (url.pathname.endsWith(".svg")) {
        return { url: `data:text/javascript,export default ${JSON.stringify(url.pathname)}`, shortCircuit: true }
      }
      if (!/\.[cm]?[jt]s$/.test(url.pathname)) url.pathname += ".ts"
      return nextResolve(url.href, context)
    }
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { canOpenPage, matchPath } = await import("../src/components/shell/nav.ts")
const { createMemberInputSchema, addTeamMemberInputSchema, endTeamInputSchema, myAreaSchema } =
  await import("../src/features/people/people.contract.ts")
const { fakePeopleApi } = await import("../src/features/people/people.fake.server.ts")
const { censusHistoryMeta } = await import("../src/features/people/people-format.ts")

void test("People stays unavailable until its backend is explicitly enabled", () => {
  const restricted = availablePermissions(["people:self"], false)
  assert.equal(canEnterDashboard(restricted), false)
  assert.deepEqual(availablePermissions(["admin:access", "people:read", "tg:users:read"], false), [
    "admin:access",
    "tg:users:read",
  ])
  assert.deepEqual(availablePermissions(["people:self", "people:read"], true), ["people:self", "people:read"])
})

void test("the academic year rolls over in September and respects an explicit override", () => {
  assert.equal(resolvePeopleYear(undefined, new Date("2026-08-31T23:59:59Z")), "2025/26")
  assert.equal(resolvePeopleYear(undefined, new Date("2026-09-01T00:00:00Z")), "2026/27")
  assert.equal(resolvePeopleYear(undefined, new Date("2027-09-01T00:00:00Z")), "2027/28")
  assert.equal(resolvePeopleYear(undefined, new Date("2099-09-01T00:00:00Z")), "2099/00")
  assert.equal(resolvePeopleYear("2024/25", new Date("2026-10-14T00:00:00Z")), "2024/25")
})

void test("calendar dates reject impossible days and retain the selected day across time zones", () => {
  const original = process.env.TZ
  try {
    for (const timezone of ["UTC", "Europe/Rome", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = timezone
      assert.equal(dateOnlyValue(parseDateOnly("2028-02-29")), "2028-02-29")
      assert.equal(dateOnlyValue(parseDateOnly("2026-10-25")), "2026-10-25")
      for (const invalid of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-01-00", "10/14/2026", ""]) {
        assert.equal(parseDateOnly(invalid), undefined)
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
  assert.equal(
    createMemberInputSchema.safeParse({ personId: "P-0007", number: "0001", fee: "paid", admittedOn: "2026-02-30" })
      .success,
    false
  )
  assert.equal(
    addTeamMemberInputSchema.safeParse({
      teamId: "it",
      personId: "P-0007",
      role: "member",
      fields: {},
      since: "2026-13-01",
    }).success,
    false
  )
  assert.equal(
    endTeamInputSchema.safeParse({ teamId: "it", personId: "P-0007", lastDay: "2026-02-29", reason: "Other", note: "" })
      .success,
    false
  )
})

void test("a restricted Team Lead can open every led team and cannot open unrelated teams or records", () => {
  const roles = { capoScope: null, leads: ["it", "events"] }
  for (const id of roles.leads)
    assert.equal(canOpenPage(matchPath(`/dashboard/people/teams/${id}`), ["people:self"], roles), true)
  assert.equal(canOpenPage(matchPath("/dashboard/people/teams/hr"), ["people:self"], roles), false)
  assert.equal(canOpenPage(matchPath("/dashboard/people/P-0007"), ["people:self"], roles), false)
  assert.equal(canOpenPage(matchPath("/dashboard/people/teams/it"), [], roles), false)
  assert.equal(canOpenPage(matchPath("/dashboard/people/teams/hr"), ["admin:access", "people:read"], roles), true)
})

void test("My area retains every active team roster and census closure is reflected consistently", async () => {
  const admin = fakePeopleApi({ permissions: PERMISSIONS, personId: "P-0007" })
  const lead = fakePeopleApi({ permissions: ["people:self"], personId: "P-0034" })
  const before = await lead.getMyArea()
  assert.equal(before.state, "linked")
  const additionalTeam = ["events", "design", "intl", "hr"].find(
    (id) => !before.rosters.some((roster) => roster.team === id)
  )
  await admin.addTeamMember({
    personId: "P-0034",
    teamId: additionalTeam,
    role: "lead",
    since: "2026-10-14",
    fields: {},
  })
  const after = myAreaSchema.parse(await lead.getMyArea())
  assert.equal(after.rosters.length, before.rosters.length + 1)
  assert.ok(
    after.rosters.some(
      (roster) => roster.team === additionalTeam && roster.members.some((member) => member.id === "P-0034")
    )
  )
  assert.ok((await lead.getMyRoles()).leads.includes(additionalTeam))
  assert.ok((await lead.listTeams()).some((team) => team.id === additionalTeam))
  const campaign = (await admin.listCampaigns()).find((item) => item.status === "open")
  const entry = {
    year: campaign.year,
    answer: null,
    source: null,
    answeredOn: null,
    declaredMember: null,
    reminders: 2,
  }
  assert.equal(
    censusHistoryMeta(entry, [{ ...campaign, closesOn: "2027-01-15" }]),
    "Open until 15 Jan 2027 · 2 reminders sent"
  )
  await admin.closeCampaign(campaign.id)
  assert.equal((await lead.getMyArea()).campaign, null)
  assert.match(censusHistoryMeta(entry, await admin.listCampaigns()), /^Closed /)
  await assert.rejects(
    lead.answerCensus({
      answer: "continues",
      course: "Informatica",
      year: "2nd year",
      campus: "Leonardo",
      keepGroups: [],
      keepTeams: [],
      reason: "",
      note: "",
    }),
    /not open/
  )
})
