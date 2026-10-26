import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const groupsPage = await readFile(new URL("../src/features/azure/groups-page.tsx", import.meta.url), "utf8")
const membersDialog = await readFile(new URL("../src/features/azure/group-members-dialog.tsx", import.meta.url), "utf8")
const groupFunctions = await readFile(new URL("../src/features/azure/groups.functions.ts", import.meta.url), "utf8")

test("empty Microsoft 365 groups can open the member dialog", () => {
  const button = groupsPage.match(/<IconButton\s+label="View members"[\s\S]*?\/>/)?.[0]
  assert.ok(button, "GroupRow must render a View members button")
  assert.match(button, /onClick=\{\(\) => onOpenDialog\(group\.id\)\}/)
  assert.doesNotMatch(button, /disabled=/)
  assert.doesNotMatch(button, /group\.members\.length/)
})

// The only group write is the backend adding a newly created member to Soci (RFC v3 §4 decision 9).
test("Microsoft 365 groups are read-only", () => {
  assert.doesNotMatch(groupFunctions, /method: "POST"/)
  assert.doesNotMatch(groupFunctions, /azure\.groups\.(?!getAll\b)/)
  assert.doesNotMatch(membersDialog, /useServerFn|useCan|groups\.functions/)
})
