import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { runInNewContext } from "node:vm"

import ts from "typescript"

async function nav() {
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
  return exports
}

const roles = { capoScope: null, leads: [] }

void test("the People mockups and the remaining pages open with people:read", async () => {
  const { canOpenPage, matchPath, serviceFor } = await nav()
  for (const path of [
    "/dashboard/people",
    "/dashboard/people/admins",
    "/dashboard/people/linking",
    // Unconnected mockups (Phase 2 and 3): gated by people:read, not by the deleted member and fee permissions.
    "/dashboard/people/members",
    "/dashboard/people/receipts",
    "/dashboard/people/census",
    "/dashboard/people/census/mock-2026",
  ]) {
    const match = matchPath(path)
    assert.equal(serviceFor(match).id, "people", path)
    assert.equal(canOpenPage(match, ["admin:access", "people:read"], roles), true, path)
    assert.equal(canOpenPage(match, ["admin:access"], roles), false, path)
    assert.equal(canOpenPage(match, ["people:self"], roles), false, path)
  }
  assert.equal(canOpenPage(matchPath("/dashboard/account/me"), ["people:self"], roles), true)
})

void test("eSign keeps its routes, permission gates and counts", async () => {
  const { canOpenPage, isRailService, matchPath, sectionPending, serviceById, serviceFor } = await nav()
  for (const path of ["/dashboard/esign/inbox", "/dashboard/esign/sign"]) {
    const match = matchPath(path)
    assert.equal(serviceFor(match).id, "esign")
    assert.equal(canOpenPage(match, ["admin:access", "esign:sign"], roles), true)
    assert.equal(canOpenPage(match, ["people:self"], roles), false)
  }
  const counts = { reports: Promise.resolve(1), signatures: Promise.resolve(2) }
  assert.equal(sectionPending("reports", "open", counts), counts.reports)
  assert.equal(sectionPending("esign", "inbox", counts), counts.signatures)
  // The Linking review queue is gone, and with it the People counts.
  assert.equal(await sectionPending("people", "linking", counts), null)
  assert.equal(await sectionPending("people", "receipts", counts), null)
  assert.equal(isRailService(serviceById("account")), false)
})
