import assert from "node:assert/strict"
import test from "node:test"

import {
  moveFreshmanCardInput,
  selectFreshmanFaqInput,
  updateFreshmanCardInput,
} from "../src/features/freshman/freshman.validation.ts"

const card = { id: "featured-1", title: "Updated", description: "Description", icon: "book", href: "/materials" }

void test("Freshman card writes accept fixed backend slot IDs and reject client-owned authorship", () => {
  for (const id of ["featured-1", "featured-2", "guides-1", "guides-5", "materials-1", "tools-2", "telegram-8"])
    assert.equal(updateFreshmanCardInput.safeParse({ ...card, id }).success, true)
  for (const input of [
    { id: "new-slot" },
    { id: "featured-3" },
    { id: "telegram-9" },
    { group: "tools" },
    { modifiedBy: 1 },
    { modifiedBySub: "forged" },
    { title: " " },
    { title: "x".repeat(121) },
    { description: "x".repeat(1001) },
    { icon: "unknown" },
  ])
    assert.equal(updateFreshmanCardInput.safeParse({ ...card, ...input }).success, false)
  assert.equal(updateFreshmanCardInput.parse({ ...card, title: "  Title  " }).title, "Title")
})

void test("Freshman destinations reject executable URLs, credentials and empty Telegram links", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.example",
    "/\\evil.example",
    "https://user:secret@example.org",
    "x".repeat(2049),
  ])
    assert.equal(updateFreshmanCardInput.safeParse({ ...card, href }).success, false)
  assert.equal(updateFreshmanCardInput.safeParse({ ...card, href: "" }).success, true)
  assert.equal(updateFreshmanCardInput.safeParse({ ...card, id: "telegram-1", href: " " }).success, false)
  assert.equal(
    updateFreshmanCardInput.safeParse({ ...card, id: "telegram-1", href: "https://t.me/example" }).success,
    true
  )
})

void test("reordering uses backend slot IDs and only adjacent directions", () => {
  for (const direction of [-1, 1])
    assert.equal(moveFreshmanCardInput.safeParse({ id: "featured-1", direction }).success, true)
  for (const direction of [-2, 0, 2, 0.5])
    assert.equal(moveFreshmanCardInput.safeParse({ id: "featured-1", direction }).success, false)
  assert.equal(moveFreshmanCardInput.safeParse({ id: "unknown", direction: 1 }).success, false)
})

void test("FAQ selections use numeric catalog IDs and the five fixed zero-based positions", () => {
  assert.deepEqual(selectFreshmanFaqInput.parse({ position: 4, faqId: 42 }), { position: 4, faqId: 42 })
  for (const position of [-1, 5, 0.5])
    assert.equal(selectFreshmanFaqInput.safeParse({ position, faqId: 42 }).success, false)
  for (const faqId of [0, -1, 0.5, "faq-1", "42"])
    assert.equal(selectFreshmanFaqInput.safeParse({ position: 0, faqId }).success, false)
  assert.equal(selectFreshmanFaqInput.safeParse({ position: 0, faqId: 42, modifiedBy: 1 }).success, false)
})
