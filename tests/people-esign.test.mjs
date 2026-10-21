import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { registerHooks } from "node:module"
import test from "node:test"
import { setImmediate } from "node:timers/promises"
import { runInNewContext } from "node:vm"

import ts from "typescript"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { fakePeopleApi } = await import("../src/features/people/people.fake.server.ts")
const { OFFICERS } = await import("../src/features/people/people.fixtures.server.ts")
const { prepareReceiptSignaturesInputSchema, receiptSignaturesSchema } =
  await import("../src/features/people/people.contract.ts")
const permissions = ["people:members:read", "people:receipts:sign", "esign:sign"]
const president = fakePeopleApi({ permissions, personId: OFFICERS.president })

void test("CIE receipt batches reject empty, duplicate and oversized input and malformed request IDs", () => {
  for (const receiptIds of [[], ["r1", "r1"], Array.from({ length: 11 }, (_, i) => `r${i}`), [""]]) {
    assert.equal(prepareReceiptSignaturesInputSchema.safeParse({ receiptIds }).success, false)
  }
  assert.equal(prepareReceiptSignaturesInputSchema.safeParse({ receiptIds: ["r1"] }).success, true)
  assert.equal(
    receiptSignaturesSchema.safeParse([{ receiptId: "r1", requestId: "r1", title: "Receipt" }]).success,
    false
  )
})

void test("CIE preparation requires both permissions and the correct confirmed officer", async () => {
  const { receipts } = await president.listReceipts({ year: null })
  const own = receipts.find((receipt) => receipt.person.id === OFFICERS.president && receipt.status === "toSign")
  assert.ok(own)
  for (const missing of ["people:receipts:sign", "esign:sign"]) {
    const api = fakePeopleApi({ permissions: permissions.filter((p) => p !== missing), personId: OFFICERS.president })
    await assert.rejects(api.prepareReceiptSignatures({ receiptIds: [own.id] }), { message: "UNAUTHORIZED" })
  }
  for (const personId of ["P-0034", `match:${OFFICERS.president}`, "none"]) {
    const api = fakePeopleApi({ permissions, personId })
    await assert.rejects(api.prepareReceiptSignatures({ receiptIds: [own.id] }), {
      message: "Only the President and the Vice-president sign receipts.",
    })
  }
  await assert.rejects(president.prepareReceiptSignatures({ receiptIds: [own.id] }), {
    message: `Receipt ${own.number} needs another signer.`,
  })
  const sent = receipts.find((receipt) => receipt.status === "sent")
  assert.ok(sent)
  await assert.rejects(president.prepareReceiptSignatures({ receiptIds: [sent.id] }), {
    message: `Receipt ${sent.number} is already signed.`,
  })
})

void test("agent mode never invents real eSign jobs or changes receipt state through CIE preparation", async () => {
  const before = structuredClone(await president.listReceipts({ year: null }))
  const receipt = before.receipts.find((r) => r.status === "toSign" && r.signer === "president")
  assert.ok(receipt)
  await assert.rejects(president.prepareReceiptSignatures({ receiptIds: [receipt.id] }), /needs the People backend/)
  assert.deepEqual(await president.listReceipts({ year: null }), before)
  assert.equal((await president.downloadReceiptsToSign()).contentType, "application/zip")
})

async function prepareHandler(dependencies) {
  const path = "src/features/people/receipts-page.tsx"
  const source = ts.createSourceFile(
    path,
    await readFile(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "prepareSigning") found = node
    if (!found) ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found)
  const compiled = ts.transpileModule(`const handler = ${found.getText()}`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None },
  }).outputText
  return runInNewContext(`${compiled}; handler`, dependencies)
}

void test("receipt preparation waits for every loader before starting the shared CIE flow", async () => {
  const events = []
  let finishReload
  const reload = new Promise((resolve) => {
    finishReload = resolve
  })
  const prepare = await prepareHandler({
    batch: [{ id: "r1" }],
    prepareSignatures: async ({ data }) => {
      assert.equal(data.receiptIds.join(), "r1")
      events.push("prepare")
      return [{ receiptId: "r1", requestId: "request-1", title: "Receipt 1" }]
    },
    router: {
      invalidate: ({ sync }) => {
        assert.equal(sync, true)
        events.push("reload")
        return reload
      },
    },
    console: { error: () => assert.fail("unexpected reload error") },
    appToast: { warning: () => assert.fail("unexpected warning") },
  })
  const pending = prepare().then((items) => {
    events.push("ready")
    return items
  })
  await setImmediate()
  assert.deepEqual(events, ["prepare", "reload"])
  finishReload()
  const items = await pending
  assert.equal(items[0].requestId, "request-1")
  assert.deepEqual(events, ["prepare", "reload", "ready"])
})

void test("a failed reload after preparation keeps the saved requests usable without preparing twice", async () => {
  const events = []
  const prepare = await prepareHandler({
    batch: [{ id: "r1" }],
    prepareSignatures: async () => {
      events.push("prepare")
      return [{ requestId: "request-1", title: "Receipt 1" }]
    },
    router: {
      invalidate: async () => {
        throw new Error("offline")
      },
    },
    console: { error: (error) => events.push(error.message) },
    appToast: { warning: (message) => events.push(message) },
  })
  assert.equal((await prepare())[0].requestId, "request-1")
  assert.deepEqual(events, ["prepare", "offline", "Signing requests prepared, but the page couldn't refresh."])
})

void test("merged navigation keeps People and eSign routes, permission gates and independent counts", async () => {
  const source = await readFile("src/components/shell/nav.ts", "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  runInNewContext(compiled, {
    exports,
    require: (name) =>
      name.endsWith("permissions")
        ? { hasPermission: (available, permission) => available.includes(permission) }
        : new Proxy({}, { get: (_, property) => String(property) }),
  })
  const roles = { capoScope: null, leads: [] }
  for (const [path, service, permission] of [
    ["/dashboard/people", "people", "people:read"],
    ["/dashboard/people/receipts", "people", "people:members:read"],
    ["/dashboard/esign/inbox", "esign", "esign:sign"],
    ["/dashboard/esign/sign", "esign", "esign:sign"],
  ]) {
    const match = exports.matchPath(path)
    assert.equal(exports.serviceFor(match).id, service)
    assert.equal(exports.canOpenPage(match, ["admin:access", permission], roles), true)
    assert.equal(exports.canOpenPage(match, ["people:self"], roles), false)
  }
  assert.equal(exports.canOpenPage(exports.matchPath("/dashboard/account/me"), ["people:self"], roles), true)
  const counts = {
    reports: Promise.resolve(1),
    signatures: Promise.resolve(2),
    linking: Promise.resolve(3),
    receipts: Promise.resolve(4),
  }
  for (const [service, section, key] of [
    ["reports", "open", "reports"],
    ["esign", "inbox", "signatures"],
    ["people", "linking", "linking"],
    ["people", "receipts", "receipts"],
  ]) {
    assert.equal(exports.sectionPending(service, section, counts), counts[key])
  }
  assert.equal(exports.isRailService(exports.serviceById("account")), false)
})

void test("eSign receipt provenance is optional for old requests and validated when present", async () => {
  const { withReceiptSource } = await import("../src/features/esign/receipt-source.ts")
  assert.equal(withReceiptSource({ id: "old" }).peopleReceipt, null)
  const source = { receiptId: "R-42", number: "2026/042", year: "2026/27" }
  assert.deepEqual(withReceiptSource({ id: "new", peopleReceipt: source }).peopleReceipt, source)
  assert.throws(() => withReceiptSource({ peopleReceipt: { ...source, year: "wrong" } }))
  assert.throws(() => withReceiptSource({ peopleReceipt: { ...source, receiptId: "" } }))
})

void test("prepared receipts cannot share or duplicate signature requests", () => {
  const item = { receiptId: "R1", requestId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", title: "Receipt" }
  assert.equal(receiptSignaturesSchema.safeParse([item, item]).success, false)
  assert.equal(receiptSignaturesSchema.safeParse([item, { ...item, receiptId: "R2" }]).success, false)
})

void test("prepared signature requests preserve exactly the selected receipt order", async () => {
  const { receiptSignaturesMatchSelection } = await import("../src/features/people/people.contract.ts")
  const selected = ["receipt-b", "receipt-d"]
  const prepared = [
    { receiptId: "receipt-b", requestId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8" },
    { receiptId: "receipt-d", requestId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8" },
  ]
  assert.equal(receiptSignaturesMatchSelection(selected, prepared), true)
  assert.equal(receiptSignaturesMatchSelection(["receipt-b"], prepared), false)
  assert.equal(receiptSignaturesMatchSelection(selected, [prepared[0]]), false)
  assert.equal(receiptSignaturesMatchSelection(selected, [prepared[1], prepared[0]]), false)
  assert.equal(receiptSignaturesMatchSelection(selected, [...prepared, prepared[0]]), false)
})

void test("CIE retries reuse the backend's distinct persistent request IDs", async () => {
  const events = []
  const prepared = [
    { receiptId: "receipt-b", requestId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", title: "Receipt B" },
    { receiptId: "receipt-d", requestId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8", title: "Receipt D" },
  ]
  const prepare = await prepareHandler({
    batch: [{ id: "receipt-b" }, { id: "receipt-d" }],
    prepareSignatures: async ({ data }) => {
      assert.deepEqual([...data.receiptIds], ["receipt-b", "receipt-d"])
      events.push("prepare")
      return prepared
    },
    router: { invalidate: async ({ sync }) => assert.equal(sync, true) },
    console: { error: (error) => assert.fail(error) },
    appToast: { warning: (message) => assert.fail(message) },
  })
  const first = await prepare()
  const retry = await prepare()
  assert.deepEqual(
    first.map(({ requestId }) => requestId),
    retry.map(({ requestId }) => requestId)
  )
  assert.deepEqual(events, ["prepare", "prepare"])
})
