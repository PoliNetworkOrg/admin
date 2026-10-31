import assert from "node:assert/strict"
import test from "node:test"

import {
  adminSummarySchema,
  ASSIGNMENT_STATUSES,
  assignmentSchema,
  linkAccountInputSchema,
  myAreaSchema,
  newPersonInputSchema,
  personInputSchema,
  personRecordSchema,
  TEAMS,
  unlinkAccountInputSchema,
  UNLINK_REASON,
} from "../src/features/people/people.contract.ts"

void test("People IDs, reasons and emails have bounded inputs", () => {
  assert.equal(
    linkAccountInputSchema.safeParse({ personId: "P-0001", accountId: "x".repeat(129), reason: "Test" }).success,
    false
  )
  assert.equal(
    personInputSchema.pick({ contactEmail: true }).safeParse({ contactEmail: `${"a".repeat(250)}@example.org` })
      .success,
    false
  )
  // Auth takes a 500-character reason, and the backend prefixes it.
  const reason = "x".repeat(500 - UNLINK_REASON.length)
  assert.equal(unlinkAccountInputSchema.safeParse({ personId: "P-0001", reason }).success, true)
  assert.equal(unlinkAccountInputSchema.safeParse({ personId: "P-0001", reason: `${reason}x` }).success, false)
})

void test("a person needs only a name; contacts may be empty", () => {
  const empty = { contactEmail: "", phone: "", telegramUsername: "" }
  assert.deepEqual(personInputSchema.parse({ firstName: " Giulia ", lastName: "Rossi", ...empty }), {
    firstName: "Giulia",
    lastName: "Rossi",
    ...empty,
  })
  assert.equal(personInputSchema.safeParse({ firstName: "", lastName: "Rossi", ...empty }).success, false)
  assert.equal(
    personInputSchema.parse({ firstName: "Giulia", lastName: "Rossi", ...empty, telegramUsername: "@giulia_r" })
      .telegramUsername,
    "giulia_r"
  )
})

void test("Add person's roles: a Capo Admin is an admin too, and each team appears once", () => {
  const person = { firstName: "Giulia", lastName: "Rossi", contactEmail: "", phone: "", telegramUsername: "" }
  const valid = { ...person, admin: true, capoScope: "Informatica", teams: [{ team: "it", role: "member" }] }
  assert.equal(newPersonInputSchema.safeParse(valid).success, true)
  assert.equal(newPersonInputSchema.safeParse({ ...valid, admin: false }).success, false)
  assert.equal(
    newPersonInputSchema.safeParse({
      ...valid,
      teams: [
        { team: "it", role: "member" },
        { team: "it", role: "lead" },
      ],
    }).success,
    false
  )
  // Only the predetermined kinds: no other role can be named.
  assert.equal(newPersonInputSchema.safeParse({ ...valid, teams: [{ team: "board", role: "member" }] }).success, false)
  assert.equal(newPersonInputSchema.safeParse({ ...valid, teams: [{ team: "it", role: "owner" }] }).success, false)
})

const assignment = {
  id: "A-1",
  kind: "admin",
  team: null,
  teamRole: null,
  capoScope: null,
  capoOfReference: { id: "P-0007", name: "Giulia Rossi" },
  fields: {},
  since: "2026-01-10",
  endedOn: null,
  endReason: null,
  assignedBy: "sub-0002",
  change: "start",
  status: "refused",
  refusal: "The actor can't give a role with permissions they don't hold",
}
const row = {
  id: "P-0012",
  firstName: "Luca",
  lastName: "Bianchi",
  contactEmail: null,
  phone: null,
  telegramUsername: "lucab",
  account: { status: "linked", sub: "sub-0012", method: "invite", linkedOn: "2026-10-01", linkedBy: "sub-0012" },
  assignments: [assignment],
}

void test("records from the Phase 1 backend parse, with each assignment's status and Auth's refusal", () => {
  const record = personRecordSchema.parse({
    ...row,
    notes: null,
    activity: [],
    createdBy: "sub-0002",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedBy: "sub-0002",
    updatedAt: "2026-01-10T09:00:00.000Z",
  })
  assert.equal(record.assignments[0].status, "refused")
  assert.equal(record.assignments[0].refusal, assignment.refusal)
  assert.equal(
    adminSummarySchema.parse({ person: row, admin: assignment, capo: null }).admin.capoOfReference.id,
    "P-0007"
  )
  for (const status of ASSIGNMENT_STATUSES)
    assert.equal(assignmentSchema.safeParse({ ...assignment, status }).success, true)
  assert.equal(assignmentSchema.safeParse({ ...assignment, status: "review" }).success, false)
})

void test("My area parses a linked record or no record", () => {
  assert.deepEqual(myAreaSchema.parse({ state: "none" }), { state: "none" })
  const linked = myAreaSchema.parse({
    state: "linked",
    person: {
      ...row,
      notes: null,
      activity: [],
      createdBy: "auth",
      createdAt: "2026-01-10T09:00:00.000Z",
      updatedBy: "auth",
      updatedAt: "2026-01-10T09:00:00.000Z",
    },
    contacts: [{ role: "hr", name: "Sara Colombo", telegram: null, team: "hr" }],
    roster: null,
  })
  assert.equal(linked.state, "linked")
})

void test("the Design team is called Design & Marketing", () => {
  assert.equal(TEAMS.design.name, "Design & Marketing")
})
