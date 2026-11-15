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

const noRoles = { capoScope: null, leads: [] }
const assignee = { capoScope: null, leads: [], regulations: true }

void test("Regolamenti pages match their section", async () => {
  const { matchPath, sectionFor, serviceFor, isDeepPage } = await nav()
  const pages = {
    "/dashboard/regulations": ["regulations-documents", "documents", false],
    "/dashboard/regulations/documents/rri": ["regulations-document", "documents", true],
    "/dashboard/regulations/drafts": ["regulations-drafts", "drafts", false],
    "/dashboard/regulations/drafts/abc12345": ["regulations-draft", "drafts", true],
    "/dashboard/regulations/drafts/abc12345/procedure": ["regulations-procedure", "drafts", true],
    "/dashboard/regulations/drafts/abc12345/diff": ["regulations-diff", "drafts", true],
    "/dashboard/regulations/drafts/abc12345/merge": ["regulations-merge", "drafts", true],
    "/dashboard/regulations/deleghe": ["regulations-deleghe", "deleghe", false],
  }
  for (const [path, [kind, section, deep]] of Object.entries(pages)) {
    const match = matchPath(path)
    assert.equal(match.kind, kind, path)
    assert.equal(serviceFor(match).id, "regulations", path)
    assert.equal(sectionFor(match).id, section, path)
    assert.equal(isDeepPage(match), deep, path)
  }
  assert.equal(matchPath("/dashboard/regulations/drafts/abc12345/other").kind, "not-found")
  assert.equal(matchPath("/dashboard/regulations/drafts/abc12345/diff/x").kind, "not-found")
})

void test("a draft assignment or a delega opens only Bozze and its drafts, without admin:access", async () => {
  const { canOpenPage, matchPath } = await nav()
  for (const path of [
    "/dashboard/regulations/drafts",
    "/dashboard/regulations/drafts/abc12345",
    "/dashboard/regulations/drafts/abc12345/procedure",
    "/dashboard/regulations/drafts/abc12345/diff",
  ])
    assert.equal(canOpenPage(matchPath(path), [], assignee), true, path)
  for (const path of ["/dashboard", "/dashboard/regulations", "/dashboard/regulations/deleghe", "/dashboard/people"])
    assert.equal(canOpenPage(matchPath(path), [], assignee), false, path)
  assert.equal(canOpenPage(matchPath("/dashboard/regulations/drafts"), [], noRoles), false)
})

void test("Documenti and Bozze need regulations:read, Deleghe regulations:rectify, all with admin:access", async () => {
  const { canOpenPage, matchPath } = await nav()
  const reader = ["admin:access", "regulations:read"]
  assert.equal(canOpenPage(matchPath("/dashboard/regulations"), reader, noRoles), true)
  assert.equal(canOpenPage(matchPath("/dashboard/regulations/drafts"), reader, noRoles), true)
  assert.equal(canOpenPage(matchPath("/dashboard/regulations/deleghe"), reader, noRoles), false)
  assert.equal(
    canOpenPage(matchPath("/dashboard/regulations/deleghe"), [...reader, "regulations:rectify"], noRoles),
    true
  )
  assert.equal(canOpenPage(matchPath("/dashboard/regulations"), ["regulations:read"], noRoles), false)
  assert.equal(canOpenPage(matchPath("/dashboard/regulations"), ["admin:access"], noRoles), false)
})
