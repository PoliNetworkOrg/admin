import assert from "node:assert/strict"
import test from "node:test"

import { validateCensusImport } from "../src/features/people/census-import.server.ts"
import {
  askToBeAddedInputSchema,
  campaignInputSchema,
  capoAreaSchema,
  createMemberInputSchema,
  personInputSchema,
  resolveReviewInputSchema,
} from "../src/features/people/people.contract.ts"

void test("People IDs, resolution, email and role choices have bounded inputs", () => {
  assert.equal(campaignInputSchema.safeParse({ campaignId: "x".repeat(129) }).success, false)
  assert.equal(
    resolveReviewInputSchema.safeParse({ reviewId: "R1", resolution: "x".repeat(65), reason: "Test" }).success,
    false
  )
  assert.equal(
    askToBeAddedInputSchema.safeParse({ roles: Array(4).fill("admin"), groupsOrTeam: "", telegramUsername: "" })
      .success,
    false
  )
  assert.equal(
    personInputSchema.pick({ personalEmail: true }).safeParse({ personalEmail: `${"a".repeat(250)}@example.org` })
      .success,
    false
  )
})

void test("census imports reject binary CSV, renamed files, oversized inputs and too many rows", async () => {
  await validateCensusImport(new File(['name,note\nAnna,"two\nlines"\n'], "responses.csv"))
  for (const [bytes, name] of [
    [new Uint8Array([0, 1, 2]), "responses.csv"],
    [new Uint8Array([255, 255]), "responses.csv"],
    ["name\n".repeat(5002), "responses.csv"],
    ['name,"unfinished', "responses.csv"],
    ["not a workbook", "responses.xlsx"],
    [new Uint8Array(10 * 1024 * 1024 + 1), "responses.csv"],
  ])
    await assert.rejects(validateCensusImport(new File([bytes], name)))
})

void test("admission cannot claim a transfer upload that does not exist", () => {
  assert.equal(
    createMemberInputSchema.safeParse({ personId: "P-0115", number: "0999", admittedOn: "2026-10-18", fee: "receipt" })
      .success,
    false
  )
})

void test("the Capo area accepts groups whose Telegram admins the backend does not know", () => {
  const area = (admins) => ({
    scope: "Informatica",
    groups: [{ chatId: "-1001", title: "Analisi 1", admins }],
    admins: [],
    requests: [],
  })
  assert.equal(capoAreaSchema.safeParse(area(null)).success, true)
  assert.equal(capoAreaSchema.safeParse(area(2)).success, true)
})
