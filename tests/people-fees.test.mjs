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

const fees = await import("../src/features/people/people-fees.ts")
const { fakePeopleApi } = await import("../src/features/people/people.fake.server.ts")
const { OFFICERS } = await import("../src/features/people/people.fixtures.server.ts")

const ALL = [
  "people:read",
  "people:write",
  "people:members:read",
  "people:members:write",
  "people:appoint",
  "people:self",
  "people:fees:write",
  "people:receipts:sign",
]
const president = fakePeopleApi({ permissions: ALL, personId: OFFICERS.president })
const vicePresident = fakePeopleApi({ permissions: ALL, personId: OFFICERS.vicePresident })
const unauthorized = { message: "UNAUTHORIZED" }

const fileOf = (name, text = "%PDF-1.4") => new File([text], name, { type: "application/pdf" })

void test("amounts are written in Italian words, as receipts print them", () => {
  assert.equal(fees.amountInWords(1000), "dieci/00")
  assert.equal(fees.amountInWords(2550), "venticinque/50")
  assert.equal(fees.amountInWords(2100), "ventuno/00")
  assert.equal(fees.amountInWords(2300), "ventitré/00")
  assert.equal(fees.amountInWords(10800), "centotto/00")
  assert.equal(fees.amountInWords(18000), "centottanta/00")
  assert.equal(fees.amountInWords(100000), "mille/00")
  assert.equal(fees.amountInWords(123456), "milleduecentotrentaquattro/56")
  assert.equal(fees.amountInWords(300000), "tremila/00")
})

void test("euro amounts parse from what people type, in cents", () => {
  assert.equal(fees.parseEuros("10"), 1000)
  assert.equal(fees.parseEuros("10.5"), 1050)
  assert.equal(fees.parseEuros("€ 10,00"), 1000)
  assert.equal(fees.parseEuros("0"), null)
  assert.equal(fees.parseEuros("ten"), null)
  assert.equal(fees.formatCents(1000), "€10.00")
})

void test("signed files are matched by the receipt number in their name", () => {
  assert.equal(fees.receiptNumberFromFileName("Ricevuta_2026-042_firmata.pdf"), "2026/042")
  assert.equal(fees.receiptNumberFromFileName("ricevuta 2026_007.pdf.p7m"), "2026/007")
  assert.equal(fees.receiptNumberFromFileName("2026042.pdf"), "2026/042")
  assert.equal(fees.receiptNumberFromFileName("Scansione 14-10.pdf"), null)
  assert.equal(fees.receiptNumberFromFileName(fees.receiptFileName("2026/120", true)), "2026/120")
  assert.equal(fees.nextReceiptNumber("2026/27", ["2025/090", "2026/041", "2026/009"]), "2026/042")
  assert.equal(fees.nextReceiptNumber("2027/28", ["2026/041"]), "2027/001")
})

void test("approving a transfer receipt marks the fee paid and issues a receipt to sign", async () => {
  const people = await president.listPeople()
  const member = people.find((person) => person.member?.fee === "receipt")
  assert.ok(member, "the fixtures hold a receipt to review")
  const review = await president.getFeeReview({ personId: member.id })
  assert.ok(review.fee.upload)
  const { receipt } = await president.approveFee({ personId: member.id })
  assert.equal(receipt, review.nextReceipt)

  const record = await president.getPerson(member.id)
  assert.equal(record.member?.fee, "paid")
  assert.equal(record.fees?.current?.upload, null)
  assert.equal(record.fees?.receipts[0]?.number, receipt)
  assert.equal(record.fees?.receipts[0]?.status, "toSign")
  assert.ok(record.activity.some((entry) => entry.text.includes(`issued receipt ${receipt}`)))
})

void test("a rejected receipt goes back to the member with the reason", async () => {
  const member = (await president.listPeople()).find((person) => person.member?.fee === "receipt")
  assert.ok(member)
  await president.rejectFee({ personId: member.id, reason: "The amount is €1.00." })
  const record = await president.getPerson(member.id)
  assert.ok(record.member?.fee === "due" || record.member?.fee === "unpaid")
  assert.equal(record.fees?.current?.rejection?.reason, "The amount is €1.00.")
  await assert.rejects(president.approveFee({ personId: member.id }), {
    message: "There is no transfer receipt to review.",
  })
})

void test("the President's own receipt is signed by the Vice-president", async () => {
  const { receipts, viewerSigner } = await president.listReceipts({ year: null })
  assert.equal(viewerSigner, "president")
  const own = receipts.find((receipt) => receipt.person.id === OFFICERS.president && receipt.status === "toSign")
  assert.ok(own, "the President's receipt waits for a signature")
  assert.equal(own.signer, "vicePresident")

  const upload = await president.previewSignedReceipts([fileOf(fees.receiptFileName(own.number, true))])
  assert.equal(upload.files[0]?.receiptId, own.id)
  await assert.rejects(president.sendSignedReceipts({ uploadId: upload.uploadId, assignments: { f1: own.id } }), {
    message: `Receipt ${own.number} needs another signer.`,
  })
  const again = await vicePresident.previewSignedReceipts([fileOf(fees.receiptFileName(own.number, true))])
  const result = await vicePresident.sendSignedReceipts({ uploadId: again.uploadId, assignments: { f1: own.id } })
  assert.deepEqual(result, { sent: 1, failed: 0 })
})

void test("unsigned files are refused and signed ones are emailed", async () => {
  const { receipts } = await president.listReceipts({ year: null })
  const waiting = receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer === "president")
  assert.ok(waiting.length >= 2)
  const [first, second] = waiting
  const upload = await president.previewSignedReceipts([
    fileOf(fees.receiptFileName(first.number)),
    fileOf("Scansione.pdf", "%PDF-1.4 /ByteRange [0 1 2 3]"),
  ])
  assert.equal(upload.files[0]?.signature.valid, false)
  assert.equal(upload.files[1]?.receiptId, null)
  assert.equal(upload.files[1]?.signature.valid, true)
  await assert.rejects(president.sendSignedReceipts({ uploadId: upload.uploadId, assignments: { f1: first.id } }), {
    message: `${fees.receiptFileName(first.number)} isn't signed.`,
  })
  const sent = await president.sendSignedReceipts({ uploadId: upload.uploadId, assignments: { f2: second.id } })
  assert.equal(sent.sent + sent.failed, 1)
  const after = (await president.listReceipts({ year: null })).receipts.find((receipt) => receipt.id === second.id)
  assert.ok(after?.status === "sent" || after?.status === "failed")
  assert.equal(after?.signedBy, "Marta Colombo")
})

void test("fee actions need their permissions", async () => {
  const reader = fakePeopleApi({ permissions: ["people:read", "people:members:read"], personId: null })
  const someone = (await president.listPeople()).find((person) => person.member?.fee === "due")
  assert.ok(someone)
  await assert.rejects(reader.remindFees({ personId: someone.id }), unauthorized)
  await assert.rejects(reader.downloadReceiptsToSign(), unauthorized)
  const page = await reader.listReceipts({ year: null })
  assert.equal(page.viewerSigner, null)
  // Signing needs the office too, not just the permission.
  const officerless = fakePeopleApi({ permissions: ALL, personId: "P-0034" })
  await assert.rejects(officerless.downloadReceiptsToSign(), {
    message: "Only the President and the Vice-president sign receipts.",
  })
})

void test("members download only their own signed receipts", async () => {
  const { receipts } = await president.listReceipts({ year: null })
  const sent = receipts.find((receipt) => receipt.status === "sent")
  const other = receipts.find((receipt) => receipt.status === "sent" && receipt.person.id !== sent?.person.id)
  assert.ok(sent && other)
  const member = fakePeopleApi({ permissions: ["people:self"], personId: sent.person.id })
  const file = await member.downloadMyReceipt({ receiptId: sent.id })
  assert.equal(file.contentType, "application/pdf")
  assert.ok(Buffer.from(file.base64, "base64").toString("latin1").startsWith("%PDF-1.4"))
  await assert.rejects(member.downloadMyReceipt({ receiptId: other.id }), {
    message: "This receipt no longer exists.",
  })
})

void test("reminders skip members reminded in the last three days", async () => {
  const first = await president.remindFees({ personId: null })
  assert.ok(first.sent > 0)
  const second = await president.remindFees({ personId: null })
  assert.equal(second.sent, 0)
  assert.equal(second.skipped, first.sent + first.skipped)
})

void test("a signed file is sent only when its receipt is the viewer's to sign", () => {
  const toSign = { status: "toSign", signer: "president" }
  const outcome = (overrides) =>
    fees.signedFileOutcome({ signed: true, receipt: toSign, viewerSigner: "president", duplicate: false, ...overrides })
  assert.equal(outcome({}), "ready")
  assert.equal(outcome({ receipt: null }), "noReceipt")
  assert.equal(outcome({ duplicate: true }), "duplicate")
  assert.equal(outcome({ receipt: { status: "sent", signer: "president" } }), "notToSign")
  assert.equal(outcome({ receipt: { status: "toSign", signer: "vicePresident" } }), "otherSigner")
  assert.equal(outcome({ signed: false }), "notSigned")
})
