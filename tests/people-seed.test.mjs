import assert from "node:assert/strict"
import test from "node:test"

import { normalizeName, planSeed, seedFileSchema } from "../scripts/people-seed/seed-plan.ts"

const SINCE = "2026-11-15"
const BOUND = Object.fromEntries(
  ["it", "hr", "design", "intl", "events"].map((team) => [team, { member: true, lead: true }])
)

function entry(fields) {
  return {
    firstName: "Mario",
    lastName: "Rossi",
    contactEmail: "",
    phone: "",
    telegramUsername: "",
    key: fields.contactEmail || "row:1",
    source: "census.xlsx › Admin › 2",
    admin: true,
    ...fields,
  }
}

function seed(people) {
  return seedFileSchema.parse({ since: SINCE, people })
}

function assignment(fields) {
  return {
    id: `A-${Math.random()}`,
    team: null,
    teamRole: null,
    capoScope: null,
    capoOfReference: null,
    fields: {},
    since: "2026-01-01",
    endedOn: null,
    endReason: null,
    assignedBy: "someone",
    change: "start",
    status: "pending",
    refusal: null,
    ...fields,
  }
}

function record(id, fields) {
  return {
    id,
    firstName: "Mario",
    lastName: "Rossi",
    contactEmail: null,
    phone: null,
    telegramUsername: null,
    account: { status: "none" },
    assignments: [],
    ...fields,
  }
}

const kinds = (plan) => plan.steps.map((step) => `${step.kind}:${step.key}`)

test("a new row is created and made admin, Capo Admins before their admins' references", () => {
  const plan = planSeed(
    seed([
      entry({ key: "a@x.it", contactEmail: "a@x.it", capoOfReference: "c@x.it" }),
      entry({ key: "c@x.it", contactEmail: "c@x.it", firstName: "Chiara", capoScope: "Ingegneria" }),
    ]),
    [],
    {},
    BOUND
  )
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(kinds(plan), [
    "create:a@x.it",
    "create:c@x.it",
    "admin:a@x.it",
    "admin:c@x.it",
    "capo:c@x.it",
    "capoRef:a@x.it",
  ])
  assert.deepEqual(plan.steps.at(-1).capo, { key: "c@x.it" })
})

test("an existing record matches by contact email, case-insensitively, and keeps the roles it holds", () => {
  const existing = [record("P-0001", { contactEmail: "A@X.it", assignments: [assignment({ kind: "admin" })] })]
  const plan = planSeed(seed([entry({ key: "a@x.it", contactEmail: "a@x.it" })]), existing, {}, BOUND)
  assert.deepEqual(plan.matches, [{ key: "a@x.it", id: "P-0001", how: "email" }])
  assert.deepEqual(plan.steps, [])
})

test("a previous run's state wins, so a repeated run creates nothing twice", () => {
  const plan = planSeed(seed([entry({ key: "row:1" })]), [record("P-0002")], { "row:1": "P-0002" }, BOUND)
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(kinds(plan), ["admin:row:1"])
})

test("a same-name record is a problem until existingId or newRecord decides", () => {
  const existing = [record("P-0003", { firstName: "Màrio", lastName: "rossi" })]
  assert.match(planSeed(seed([entry({})]), existing, {}, BOUND).problems[0], /possibly P-0003/)
  const linked = planSeed(seed([entry({ existingId: "P-0003" })]), existing, {}, BOUND)
  assert.deepEqual(linked.matches[0], { key: "row:1", id: "P-0003", how: "existingId" })
  assert.deepEqual(kinds(planSeed(seed([entry({ newRecord: true })]), existing, {}, BOUND)), [
    "create:row:1",
    "admin:row:1",
  ])
})

test("rows that clash within the file are problems", () => {
  const plan = planSeed(
    seed([
      entry({ key: "k", contactEmail: "a@x.it" }),
      entry({ key: "k", contactEmail: "a@x.it", firstName: "Luca" }),
      entry({ key: "j", firstName: "Luca" }),
    ]),
    [],
    {},
    BOUND
  )
  assert.equal(plan.problems.length, 3)
})

test("role rules: a Capo Admin is an admin, references point at Capo Admins, one Lead per team", () => {
  const existing = [
    record("P-0010", {
      firstName: "Lea",
      assignments: [assignment({ kind: "team", team: "it", teamRole: "lead" })],
    }),
  ]
  const plan = planSeed(
    seed([
      entry({ key: "capo-not-admin", firstName: "A", admin: false, capoScope: "Design" }),
      entry({ key: "bad-ref", firstName: "B", capoOfReference: "plain" }),
      entry({ key: "plain", firstName: "C" }),
      entry({ key: "second-lead", firstName: "D", teams: [{ team: "it", role: "lead" }] }),
      entry({ key: "missing-ref", firstName: "E", capoOfReference: "nobody" }),
    ]),
    existing,
    {},
    BOUND
  )
  assert.equal(plan.problems.length, 4)
  assert.ok(plan.problems.some((problem) => problem.includes("must be an admin")))
  assert.ok(plan.problems.some((problem) => problem.includes("won't be a Capo Admin")))
  assert.ok(plan.problems.some((problem) => problem.includes("already has a Lead")))
  assert.ok(plan.problems.some((problem) => problem.includes("no row key or record ID")))
})

test("a create interrupted before the backend answered needs a person to say whether the record exists", () => {
  const pending = { "row:1": "pending" }
  const plan = planSeed(seed([entry({ newRecord: true })]), [record("P-0004")], pending, BOUND)
  assert.match(plan.problems[0], /interrupted run/)
  const resolved = planSeed(seed([entry({ existingId: "P-0004" })]), [record("P-0004")], pending, BOUND)
  assert.deepEqual(resolved.problems, [])
  assert.deepEqual(kinds(resolved), ["admin:row:1"])
})

test("a Capo Admin referenced by record ID counts the appointment planned for that record's row", () => {
  const existing = [record("P-0005", { firstName: "Chiara", contactEmail: "c@x.it" })]
  const plan = planSeed(
    seed([
      entry({ key: "c@x.it", firstName: "Chiara", contactEmail: "c@x.it", capoScope: "Design" }),
      entry({ key: "a@x.it", contactEmail: "a@x.it", capoOfReference: "P-0005" }),
    ]),
    existing,
    {},
    BOUND
  )
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(plan.steps.at(-1), { kind: "capoRef", key: "a@x.it", capo: { id: "P-0005" } })
})

test("a team role Auth doesn't bind stops the plan before anything is created", () => {
  const plan = planSeed(
    seed([entry({ teams: [{ team: "hr", role: "lead" }] })]),
    [],
    {},
    { hr: { member: true, lead: false } }
  )
  assert.match(plan.problems[0], /binds no role to hr lead/)
})

test("the seed file validates contacts like the dashboard does", () => {
  assert.throws(() => seed([entry({ telegramUsername: "ab" })]))
  assert.equal(seed([entry({ telegramUsername: "@mario_rossi" })]).people[0].telegramUsername, "mario_rossi")
  assert.equal(normalizeName("  Nicolò ", "D’Amico"), "nicolo damico")
})
