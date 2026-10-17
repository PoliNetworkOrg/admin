import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import ts from "typescript"

async function handler(path, name) {
  const text = await readFile(path, "utf8")
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = node
    if (!found) ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found, `${name} not found in ${path}`)
  return found
}

function calls(node, pattern) {
  const found = []
  function visit(current) {
    if (ts.isCallExpression(current) && pattern.test(current.expression.getText())) found.push(current)
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

function insideTryBlock(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isBlock(current) && ts.isTryStatement(current.parent) && current.parent.tryBlock === current) return current
  }
  return null
}

const RELOAD = /^(router\.invalidate|reload)$/
const TOAST = /^appToast\./

function assertReloadBeforeToasts(fn, label) {
  const reloads = calls(fn, RELOAD)
  const toasts = calls(fn, TOAST)
  assert.ok(reloads.length > 0, `${label} reloads the loaders`)
  assert.ok(toasts.length > 0, `${label} shows a toast`)
  const reloadAt = Math.min(...reloads.map((c) => c.getStart()))
  for (const toast of toasts)
    assert.ok(toast.getStart() > reloadAt, `${label}: ${toast.getText()} comes before the loaders reload`)
}

void test("creating an eSign request reloads the shell before the toast and keeps later failures out of the create error", async () => {
  const submit = await handler("src/features/esign/new-request-page.tsx", "submit")
  assertReloadBeforeToasts(submit, "submit")

  const [create] = calls(submit, /^createFn$/)
  const createTry = insideTryBlock(create)
  assert.ok(createTry, "createFn is awaited in its own try")
  for (const later of [...calls(submit, RELOAD), ...calls(submit, /^navigate$/), ...calls(submit, TOAST)])
    assert.ok(later.getStart() >= createTry.end, `${later.getText()} is outside createFn's try`)

  const [navigate] = calls(submit, /^navigate$/)
  const [invalidate] = calls(submit, RELOAD)
  assert.ok(navigate.getStart() > invalidate.getStart(), "the new request opens after the loaders reload")
  assert.match(navigate.getText(), /requestId: request\.id/, "it opens the request just created")
})

void test("signing with CIE reloads the page before closing the dialog and toasting", async () => {
  const finish = await handler("src/features/esign/sign-with-cie.tsx", "finish")
  assertReloadBeforeToasts(finish, "finish")
  const [close] = calls(finish, /^setPhase$/)
  assert.ok(close.getStart() > calls(finish, RELOAD)[0].getStart(), "the dialog closes after the reload")
})

void test("retrying an eSign delivery reloads the page before toasting the outcome", async () => {
  assertReloadBeforeToasts(await handler("src/features/esign/request-page.tsx", "retry"), "retry")
})
