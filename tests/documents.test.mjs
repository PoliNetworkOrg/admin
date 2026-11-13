import assert from "node:assert/strict"
import test from "node:test"

import {
  documentCategoryInput,
  documentInput,
  documentsErrorMessage,
  isValidDocumentFile,
  parseDocumentVersionForm,
  reorderDocumentsInput,
  slugFromTitle,
  updateDocumentInput,
} from "../src/features/documents/documents.validation.ts"

const pdf = (size = 8) => new File([new Uint8Array(size)], "statuto.pdf", { type: "application/pdf" })

void test("document slugs follow the backend's lowercase kebab-case rule", () => {
  const category = { slug: "statuto", title: "Statuto", description: "" }
  for (const slug of ["statuto", "statuto-2024", "a1-b2-c3", "x".repeat(100)])
    assert.equal(documentCategoryInput.safeParse({ ...category, slug }).success, true, slug)
  for (const slug of [
    "",
    "Statuto",
    "statuto_2024",
    "-statuto",
    "statuto-",
    "sta--tuto",
    "statuto 2024",
    "x".repeat(101),
  ])
    assert.equal(documentCategoryInput.safeParse({ ...category, slug }).success, false, slug)
  assert.equal(documentCategoryInput.parse({ ...category, slug: " statuto " }).slug, "statuto")
})

void test("document fields enforce the backend's lengths and reject unknown keys", () => {
  const document = { categoryId: 1, slug: "statuto", title: "Statuto", description: "" }
  assert.equal(documentInput.parse({ ...document, title: "  Statuto  " }).title, "Statuto")
  for (const input of [
    { title: " " },
    { title: "x".repeat(201) },
    { description: "x".repeat(2001) },
    { categoryId: 0 },
    { position: 3 },
  ])
    assert.equal(documentInput.safeParse({ ...document, ...input }).success, false, JSON.stringify(input))
  assert.equal(updateDocumentInput.safeParse({ ...document, id: 2 }).success, true)
  assert.equal(updateDocumentInput.safeParse(document).success, false)
})

void test("document reorders need unique ids", () => {
  assert.equal(reorderDocumentsInput.safeParse({ categoryId: 1, ids: [3, 1, 2] }).success, true)
  assert.equal(reorderDocumentsInput.safeParse({ categoryId: 1, ids: [] }).success, false)
  assert.equal(reorderDocumentsInput.safeParse({ categoryId: 1, ids: [1, 1] }).success, false)
})

void test("document versions accept a dated PDF up to 10 MB", () => {
  function form(overrides = {}) {
    const data = new FormData()
    const values = { documentId: "4", version: " 2026 ", date: "2026-11-13", file: pdf(), ...overrides }
    for (const [key, value] of Object.entries(values)) data.set(key, value)
    return data
  }

  assert.deepEqual(
    { ...parseDocumentVersionForm(form()), file: undefined },
    { documentId: 4, version: "2026", date: "2026-11-13", file: undefined }
  )
  assert.throws(() => parseDocumentVersionForm(form({ documentId: "x" })), /INVALID_DOCUMENT/)
  assert.throws(() => parseDocumentVersionForm(form({ version: " " })), /INVALID_VERSION/)
  assert.throws(() => parseDocumentVersionForm(form({ version: "x".repeat(51) })), /INVALID_VERSION/)
  assert.throws(() => parseDocumentVersionForm(form({ date: "2026-11-13T00:00:00.000Z" })), /INVALID_DATE/)
  assert.throws(() => parseDocumentVersionForm(form({ date: "2026-02-30" })), /INVALID_DATE/)
  const text = new File(["x"], "statuto.txt", { type: "text/plain" })
  assert.throws(() => parseDocumentVersionForm(form({ file: text })), /INVALID_FILE_TYPE/)
  assert.throws(() => parseDocumentVersionForm(form({ file: pdf(10 * 1024 * 1024 + 1) })), /FILE_TOO_LARGE/)

  assert.equal(isValidDocumentFile(pdf(10 * 1024 * 1024)), true)
  assert.equal(isValidDocumentFile(pdf(10 * 1024 * 1024 + 1)), false)
  assert.equal(isValidDocumentFile(pdf(0)), false)
  assert.equal(isValidDocumentFile(text), false)
})

void test("a title suggests a valid slug", () => {
  assert.equal(slugFromTitle("Statuto dell'Associazione 2024"), "statuto-dell-associazione-2024")
  assert.equal(slugFromTitle("  Regolamento è Più  "), "regolamento-e-piu")
  assert.equal(slugFromTitle("!!!"), "")
  const long = slugFromTitle(`${"a".repeat(99)} b`)
  assert.ok(long.length <= 100 && !long.endsWith("-"), long)
})

void test("every backend error code has its own message", () => {
  const cases = [
    ["CATEGORY_NOT_EMPTY", "category", /still has documents/],
    ["CATEGORY_NOT_FOUND", "document", /chosen category no longer exists/],
    ["DUPLICATE_SLUG", "category", /Another category/],
    ["DUPLICATE_SLUG", "document", /Another document/],
    ["DUPLICATE_VERSION", "version", /already has a version/],
    ["INVALID_ORDER", "category", /changed.*Reload/],
    ["NOT_FOUND", "category", /category no longer exists/],
    ["NOT_FOUND", "document", /document no longer exists/],
    ["NOT_FOUND", "version", /version no longer exists/],
    ["UNAUTHORIZED", "document", /permission/],
    ["FILE_TOO_LARGE", "version", /10 MB/],
  ]
  for (const [code, subject, expected] of cases)
    assert.match(documentsErrorMessage(new Error(code), subject, "fallback"), expected, code)
  assert.equal(documentsErrorMessage(new Error("boom"), "document", "fallback"), "fallback")
})
