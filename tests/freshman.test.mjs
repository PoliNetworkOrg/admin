import assert from "node:assert/strict"
import test from "node:test"

import { createFreshmanMockApi, freshmanContentInput } from "../src/features/freshman/freshman.api.ts"

function mockStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

void test("freshman slots match the site and reject additions, removal and changed slot identities", async () => {
  const content = await createFreshmanMockApi(mockStorage()).getContent()
  assert.equal(content.resources.length, 10)
  assert.equal(content.telegram.length, 8)
  assert.equal(content.faqIds.length, 5)
  for (const section of ["resources", "telegram", "faqIds"]) {
    assert.equal(freshmanContentInput.safeParse({ ...content, [section]: content[section].slice(1) }).success, false)
    assert.equal(
      freshmanContentInput.safeParse({ ...content, [section]: [...content[section], content[section][0]] }).success,
      false
    )
  }
  const changed = structuredClone(content)
  changed.resources[0].id = "new-slot"
  assert.equal(freshmanContentInput.safeParse(changed).success, false)
})

void test("demo edits survive a new API instance and preserve other slots", async () => {
  const storage = mockStorage()
  const api = createFreshmanMockApi(storage)
  const before = await api.getContent()
  const card = before.resources[0]
  await api.updateCard("resources", card.id, { ...card, title: "Updated", href: "/updated" })
  const after = await createFreshmanMockApi(storage).getContent()
  assert.equal(after.resources[0].title, "Updated")
  assert.equal(after.resources[0].href, "/updated")
  assert.deepEqual(after.resources.slice(1), before.resources.slice(1))
  assert.deepEqual(after.telegram, before.telegram)
  assert.deepEqual(after.faqIds, before.faqIds)
  await assert.rejects(api.updateCard("resources", "missing", card))
})

void test("destinations reject executable URLs and empty Telegram links without changing saved content", async () => {
  const api = createFreshmanMockApi(mockStorage())
  const before = await api.getContent()
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.example",
    "/\\evil.example",
    "https://user:secret@example.org",
  ]) {
    await assert.rejects(api.updateCard("resources", before.resources[0].id, { ...before.resources[0], href }))
  }
  await assert.rejects(api.updateCard("telegram", before.telegram[0].id, { ...before.telegram[0], href: "" }))
  assert.deepEqual(await api.getContent(), before)
})

void test("FAQ selection swaps occupied positions and rejects unknown questions and slots", async () => {
  const api = createFreshmanMockApi(mockStorage())
  const before = await api.getContent()
  const after = await api.selectFaq(0, before.faqIds[2])
  assert.equal(after.faqIds[0], before.faqIds[2])
  assert.equal(after.faqIds[2], before.faqIds[0])
  assert.equal(new Set(after.faqIds).size, 5)
  await assert.rejects(api.selectFaq(0, "missing"))
  await assert.rejects(api.selectFaq(-1, before.faqIds[0]))
  await assert.rejects(api.selectFaq(5, before.faqIds[0]))
  assert.deepEqual(await api.getContent(), after)
})

void test("storage failures reject saves instead of reporting success", async () => {
  const api = createFreshmanMockApi({
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage unavailable")
    },
  })
  const content = await api.getContent()
  await assert.rejects(
    api.updateCard("resources", content.resources[0].id, content.resources[0]),
    /Storage unavailable/
  )
})

void test("card reordering preserves fixed slots and cannot cross section boundaries", async () => {
  const api = createFreshmanMockApi(mockStorage())
  const before = await api.getContent()
  const after = await api.moveCard("resources", before.resources[0].id, 1)
  assert.equal(after.resources[0].title, before.resources[1].title)
  assert.equal(after.resources[1].title, before.resources[0].title)
  assert.deepEqual(
    after.resources.map(({ id, group }) => ({ id, group })),
    before.resources.map(({ id, group }) => ({ id, group }))
  )
  assert.deepEqual(after.resources.slice(2), before.resources.slice(2))
  await assert.rejects(api.moveCard("resources", before.resources[1].id, 1))
  await assert.rejects(api.moveCard("resources", before.resources[0].id, -1))
  const telegram = await api.moveCard("telegram", before.telegram[0].id, 1)
  assert.equal(telegram.telegram[0].title, before.telegram[1].title)
  assert.equal(telegram.telegram.length, 8)
})
