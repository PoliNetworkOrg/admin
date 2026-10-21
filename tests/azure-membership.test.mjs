import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const groupsPage = await readFile(new URL("../src/features/azure/groups-page.tsx", import.meta.url), "utf8")
const membershipDialog = await readFile(new URL("../src/features/azure/membership-dialog.tsx", import.meta.url), "utf8")

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
