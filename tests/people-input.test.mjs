import assert from "node:assert/strict"
import test from "node:test"

import {
  capoAreaSchema,
  linkAccountInputSchema,
  myAreaSchema,
  personInputSchema,
  personRecordSchema,
} from "../src/features/people/people.contract.ts"

void test("People IDs, reasons and emails have bounded inputs", () => {
  assert.equal(
    linkAccountInputSchema.safeParse({ personId: "P-0001", accountId: "x".repeat(129), reason: "Test" }).success,
    false
  )
  assert.equal(
    personInputSchema.pick({ personalEmail: true }).safeParse({ personalEmail: `${"a".repeat(250)}@example.org` })
      .success,
    false
  )
})

// What the backend sends until its own cleanup (PoliNetworkOrg/backend#100) deploys.
const legacyProfile = {
  firstName: "Giulia",
  lastName: "Rossi",
  personalEmail: null,
  phone: null,
  telegramUsername: "giuliarossi",
  telegramId: null,
  course: "Ingegneria Informatica",
  year: "2nd year",
  campus: "Leonardo",
  otherAssociations: [],
  studentRepresentative: null,
}
const legacyRecord = {
  id: "P-0142",
  profile: legacyProfile,
  member: { number: "0290", status: "active", admittedOn: "2024-10-01", fee: "paid", m365Email: "g@polinetwork.org" },
  isMember: true,
  admin: {
    status: "active",
    since: "2024-10-03",
    endedOn: null,
    endReason: null,
    groups: [{ chatId: "-1001", title: "Basi di Dati" }],
    requested: [{ chatId: "-1002", title: "Reti Logiche", requestedOn: "2026-10-09" }],
    availableAsCapo: true,
    capoOfReference: null,
    capoScope: null,
  },
  teams: [],
  census: [{ year: "2026/27", answer: null, answeredOn: null, source: null, declaredMember: null, reminders: 1 }],
  consents: { privacy: null, photo: null },
  account: { status: "review", reviewId: "r1", issue: "Telegram account already linked to another record" },
  notes: null,
  discrepancies: [{ kind: "declared-member", message: "Declared a member", suggestedTelegram: null }],
  activity: [],
  fees: { current: null, receipts: [] },
}

void test("records from the current backend parse, dropping what People no longer shows", () => {
  const record = personRecordSchema.parse(legacyRecord)
  for (const key of ["member", "isMember", "census", "fees"]) assert.ok(!(key in record), key)
  assert.ok(!("groups" in record.admin))
  assert.ok(!("requested" in record.admin))
  // Record matching is gone: a record held for review reads as not linked.
  assert.deepEqual(record.account, { status: "none" })
  assert.equal(record.discrepancies[0].kind, "declared-member")
})

void test("My area from the current backend parses, and a first-sign-in match reads as no record", () => {
  const linked = myAreaSchema.parse({
    state: "linked",
    person: legacyRecord,
    feeInstructions: { beneficiary: "PoliNetwork", iban: "IT00", reference: "Quota" },
    campaign: { id: "2026", year: "2026/27", closesOn: "2026-10-31" },
    contacts: [{ role: "hr", name: "HR team", telegram: null, email: "hr@polinetwork.org", team: null }],
    roster: {
      team: "it",
      members: [{ id: "P-0142", name: "Giulia Rossi", role: "member", telegram: null, email: "g@polinetwork.org" }],
    },
  })
  assert.equal(linked.state, "linked")
  assert.ok(!("feeInstructions" in linked))
  assert.ok(!("campaign" in linked))
  assert.ok(!("email" in linked.contacts[0]))
  assert.ok(!("email" in linked.roster.members[0]))
  // The old backend's "none" carries the request to be added; the new one sends the state alone.
  assert.deepEqual(myAreaSchema.parse({ state: "none", request: { sentOn: "2026-10-01" } }), { state: "none" })
  assert.deepEqual(myAreaSchema.parse({ state: "none" }), { state: "none" })
  const match = myAreaSchema.parse({
    state: "match",
    candidate: { id: "P-0142", name: "Giulia Rossi", course: "", year: "", campus: "Leonardo", roles: [] },
    reason: "Matched on your email address.",
  })
  assert.deepEqual(match, { state: "none" })
})

void test("the Capo area from the current backend parses without its Telegram groups and join requests", () => {
  const area = capoAreaSchema.parse({
    scope: "Informatica",
    groups: [{ chatId: "-1001", title: "Analisi 1", admins: null }],
    admins: [],
    requests: [],
  })
  assert.deepEqual(area, { scope: "Informatica", admins: [] })
})

void test("records from the cleaned-up backend parse without the dropped fields", () => {
  const { member, isMember, census, fees, ...rest } = legacyRecord
  const { groups, requested, ...admin } = legacyRecord.admin
  void [member, isMember, census, fees, groups, requested]
  const record = personRecordSchema.parse({
    ...rest,
    admin,
    account: { status: "none" },
    discrepancies: [{ kind: "needs-review", message: "Check the sign-in", suggestedTelegram: null }],
  })
  assert.equal(record.admin.availableAsCapo, true)
  assert.equal(record.discrepancies[0].kind, "needs-review")
  assert.deepEqual(capoAreaSchema.parse({ scope: "Informatica", admins: [] }), { scope: "Informatica", admins: [] })
})
