import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import ts from "typescript"

const groupsPage = await readFile(new URL("../src/features/azure/groups-page.tsx", import.meta.url), "utf8")
const membershipDialog = await readFile(new URL("../src/features/azure/membership-dialog.tsx", import.meta.url), "utf8")

function extractFunction(name) {
  const source = ts.createSourceFile(
    "membership-dialog.tsx",
    membershipDialog,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let declaration
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(declaration, `${name} must exist in the membership dialog`)
  const javascript = ts
    .transpile(declaration.getText(source), { target: ts.ScriptTarget.ES2020 })
    .replace(/^"use strict";\s*/, "")
  return new Function("scope", `with (scope) { ${javascript}\nreturn ${name}\n }`)
}

function mutationScope(overrides = {}) {
  const events = []
  const scope = {
    adding: true,
    canAdd: true,
    canWrite: true,
    error: null,
    group: { id: "group-1", displayName: "Test group" },
    pending: false,
    selected: { id: "user-1", name: "Test user" },
    confirming: false,
    addMember: async () => {
      events.push("add")
      return { error: null }
    },
    removeMember: async () => {
      events.push("remove")
      return { error: null }
    },
    router: {
      invalidate: async () => {
        events.push("invalidate")
      },
    },
    appToast: {
      success: () => events.push("success"),
      warning: () => events.push("warning"),
    },
    setPending(value) {
      scope.pending = value
      events.push(value ? "pending" : "settled")
    },
    setError(value) {
      scope.error = value
    },
    setSelected(value) {
      scope.selected = value
    },
    setConfirming(value) {
      scope.confirming = value
    },
    showMembers: () => events.push("show-members"),
    onOpenChange: (open) => events.push(open ? "open" : "close"),
    console: { error: () => events.push("logged-error") },
    events,
    ...overrides,
  }
  return scope
}

test("empty Microsoft 365 groups can open the member dialog", () => {
  const button = groupsPage.match(/<IconButton\s+label="View members"[\s\S]*?\/>/)?.[0]
  assert.ok(button, "GroupRow must render a View members button")
  assert.match(button, /onClick=\{\(\) => onOpenDialog\(group\.id\)\}/)
  assert.doesNotMatch(button, /disabled=/)
  assert.doesNotMatch(button, /group\.members\.length/)
})

test("viewing members is read-only without group write access", () => {
  assert.match(membershipDialog, /const canWrite = useCan\("azure:groups:write"\)/)
  assert.match(membershipDialog, /const canAdd = canWrite && directoryMembers !== null/)
  assert.match(membershipDialog, /disabled=\{!canAdd\}/)
  assert.match(membershipDialog, /\{canWrite \? \([\s\S]*?Add member[\s\S]*?\) : null\}/)
  assert.match(membershipDialog, /\{canWrite \? \([\s\S]*?label="Remove member"[\s\S]*?\) : null\}/)
})

test("member removal requires confirmation before the mutation", () => {
  assert.match(membershipDialog, /if \(!adding\) setConfirming\(true\)/)
  assert.match(membershipDialog, /const result = adding \? await addMember\(input\) : await removeMember\(input\)/)
  assert.match(membershipDialog, /confirming \? \([\s\S]*?Remove member[\s\S]*?\) : \(/)
})

test("membership changes refresh route data before closing or showing success", () => {
  const mutation = membershipDialog.indexOf(
    "const result = adding ? await addMember(input) : await removeMember(input)"
  )
  const refresh = membershipDialog.indexOf("await router.invalidate({ sync: true })", mutation)
  const successToast = membershipDialog.indexOf("appToast.success(", refresh)
  const closeAfterRefresh = membershipDialog.indexOf("if (refreshed) showMembers()", refresh)
  assert.ok(mutation >= 0, "mutation must be issued")
  assert.ok(refresh > mutation, "router data must refresh after the mutation")
  assert.ok(successToast > refresh, "success toast must wait until refresh completes")
  assert.ok(closeAfterRefresh > refresh, "dialog state must wait until refresh completes")
  assert.match(membershipDialog, /catch \(caught\) \{\s*console\.error\(caught\)/)
  assert.match(membershipDialog, /The membership was updated, but the latest group data could not be refreshed\./)
})

test("read-only users cannot call a membership mutation", async () => {
  const scope = mutationScope({ canWrite: false, canAdd: false })
  await extractFunction("submit")(scope)()
  assert.deepEqual(scope.events, [])
})

test("the add picker stays closed when member-directory access is missing", () => {
  const scope = mutationScope({ adding: false, canAdd: false })
  extractFunction("showAddPicker")(scope)()
  assert.equal(scope.adding, false)
  assert.deepEqual(scope.events, [])
})

test("adding with mocked server functions waits for refresh before success and keeps the dialog open", async () => {
  const scope = mutationScope()
  await extractFunction("submit")(scope)()
  assert.deepEqual(scope.events, ["pending", "add", "invalidate", "success", "show-members", "settled"])
  assert.equal(scope.pending, false)
})

test("removing with mocked server functions warns on refresh failure without retrying the mutation", async () => {
  const scope = mutationScope({
    adding: false,
    router: {
      invalidate: async () => {
        scope.events.push("invalidate")
        throw new Error("refresh failed")
      },
    },
  })
  const choose = extractFunction("choose")(scope)
  choose({ id: "user-1", name: "Test user" })
  assert.equal(scope.confirming, true)
  await extractFunction("submit")(scope)()
  assert.deepEqual(scope.events, [
    "pending",
    "remove",
    "invalidate",
    "logged-error",
    "warning",
    "success",
    "close",
    "settled",
  ])
})
