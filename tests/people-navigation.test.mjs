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

void test("the People mockup and the remaining pages open with people:read", async () => {
  const { canOpenPage, matchPath, serviceFor } = await nav()
  for (const path of [
    "/dashboard/people",
    "/dashboard/people/admins",
    "/dashboard/people/linking",
    // The census is an unconnected mockup (Phase 3): gated by people:read.
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

void test("People's Soci pages open with soci:read, under the Soci group", async () => {
  const { canOpenPage, isDeepPage, matchPath, sectionFor, serviceById, serviceFor } = await nav()
  for (const [path, section] of [
    ["/dashboard/people/soci", "soci"],
    ["/dashboard/people/soci/344", "soci"],
    ["/dashboard/people/fees", "fees"],
  ]) {
    const match = matchPath(path)
    assert.equal(serviceFor(match).id, "people", path)
    assert.equal(sectionFor(match).id, section, path)
    assert.equal(canOpenPage(match, ["admin:access", "soci:read"], roles), true, path)
    assert.equal(canOpenPage(match, ["admin:access", "people:read"], roles), false, path)
    assert.equal(canOpenPage(match, ["soci:read"], roles), false, path)
  }
  const socio = matchPath("/dashboard/people/soci/344")
  assert.equal(socio.kind, "people-socio")
  assert.equal(socio.number, 344)
  assert.equal(isDeepPage(matchPath("/dashboard/people/soci/344")), true)
  assert.equal(matchPath("/dashboard/people/soci/0344").kind, "not-found")
  assert.equal(matchPath("/dashboard/people/members").kind, "not-found")
  // The Receipts mockup is gone: Soci › Fees replaced it.
  assert.equal(matchPath("/dashboard/people/receipts").kind, "not-found")
  // Groups are contiguous: the panel draws each title once, above its first section.
  const groups = serviceById("people").sections.map((section) => section.group)
  assert.equal([...new Set(groups)].join(), "Volunteers,Soci")
  assert.equal(groups.join(), groups.toSorted((a, b) => groups.indexOf(a) - groups.indexOf(b)).join())
  assert.equal(
    serviceById("people")
      .sections.filter((section) => section.group === "Volunteers")
      .map((section) => section.id)
      .join(),
    "overview,admins,teams,census,linking"
  )
})

void test("Microsoft 365 › Members needs azure:members:read alone", async () => {
  const { canOpenPage, matchPath } = await nav()
  const members = matchPath("/dashboard/azure/members")
  assert.equal(canOpenPage(members, ["admin:access", "azure:members:read"], roles), true)
  assert.equal(canOpenPage(members, ["admin:access", "azure:members:create"], roles), false)
})

void test("eSign keeps its routes, permission gates and counts", async () => {
  const { canOpenPage, isRailService, matchPath, sectionPending, serviceById, serviceFor } = await nav()
  for (const path of ["/dashboard/esign/inbox", "/dashboard/esign/sign"]) {
    const match = matchPath(path)
    assert.equal(serviceFor(match).id, "esign")
    assert.equal(canOpenPage(match, ["admin:access", "esign:sign"], roles), true)
    assert.equal(canOpenPage(match, ["people:self"], roles), false)
  }
  const counts = { reports: Promise.resolve(1), signatures: Promise.resolve(2), fees: Promise.resolve(3) }
  assert.equal(sectionPending("reports", "open", counts), counts.reports)
  assert.equal(sectionPending("esign", "inbox", counts), counts.signatures)
  // Receipts to review: a count on Soci › Fees, like Reports › Open.
  assert.equal(sectionPending("people", "fees", counts), counts.fees)
  // The Linking review queue is gone, and with it the People counts.
  assert.equal(await sectionPending("people", "linking", counts), null)
  assert.equal(isRailService(serviceById("account")), false)
})
