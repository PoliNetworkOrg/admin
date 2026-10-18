import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { setImmediate } from "node:timers/promises"
import { runInNewContext } from "node:vm"

import ts from "typescript"

const path = "src/features/esign/pdf-viewer.tsx"
const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let effect
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && !effect)
    effect = node.arguments[0]
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(effect)
const compiled = ts.transpileModule(`const effect = ${effect.getText(source)}`, {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None },
}).outputText

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function start(loadPdfjs, inferPages = true) {
  const documents = []
  const errors = []
  const run = runInNewContext(`${compiled}; effect`, {
    data: new Uint8Array([1, 2, 3]),
    inferPages,
    loadPdfjs,
    setDoc: (doc) => documents.push(doc),
    setError: (error) => errors.push(error),
    console: { error: (error) => errors.push(error) },
  })
  return { cleanup: run(), documents, errors }
}

void test("closing a PDF before pdf.js loads starts no document or worker", async () => {
  const library = deferred()
  let created = 0
  const state = start(() => library.promise)
  state.cleanup()
  library.resolve({
    getDocument: () => {
      created++
      throw new Error("Late worker")
    },
  })
  await setImmediate()
  assert.equal(created, 0)
  assert.ok(state.documents.every((doc) => doc === null))
})

void test("closing while a document loads destroys its task and ignores its late result", async () => {
  const loading = deferred()
  let destroyed = 0
  const state = start(async () => ({
    getDocument: () => ({
      promise: loading.promise,
      destroy: () => {
        destroyed++
      },
    }),
  }))
  await setImmediate()
  state.cleanup()
  loading.resolve({
    numPages: 2,
    getPage: () => {
      throw new Error("Read after closing")
    },
  })
  await setImmediate()
  assert.equal(destroyed, 1)
  assert.ok(state.documents.every((doc) => doc === null))
})

void test("receipt previews infer every page size and release the document after viewing", async () => {
  let destroyed = 0
  const pdf = {
    numPages: 6,
    getPage: async (number) => ({ getViewport: () => ({ width: 595, height: number * 100 }) }),
  }
  const state = start(async () => ({
    getDocument: () => ({
      promise: Promise.resolve(pdf),
      destroy: () => {
        destroyed++
      },
    }),
  }))
  await setImmediate()
  assert.equal(state.documents[0].pages.length, 6)
  assert.equal(state.documents[0].pages[5].height, 600)
  state.cleanup()
  assert.equal(destroyed, 1)
  assert.equal(state.documents.at(-1), null)
})
