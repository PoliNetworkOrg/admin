import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { setImmediate } from "node:timers/promises"
import { runInNewContext } from "node:vm"

import ts from "typescript"

// Run the production handlers with controlled network, router and React state dependencies.
async function handler(path, name, dependencies) {
  const text = await readFile(path, "utf8")
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name)
      found = node.initializer
    if (!found) ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found, `${name} not found in ${path}`)
  const compiled = ts.transpileModule(`const handler = ${found.getText()}`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None },
  }).outputText
  return runInNewContext(`${compiled}; handler`, { ...dependencies })
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function environment() {
  const events = []
  const state = {}
  const reload = deferred()
  const dependencies = {
    Error,
    router: {
      invalidate: (options) => {
        assert.equal(options.sync, true)
        events.push("reload")
        return reload.promise
      },
    },
    console: { error: (error) => events.push(["logged", error.message]) },
    appToast: Object.fromEntries(
      ["success", "warning", "error"].map((tone) => [tone, (message) => events.push([tone, message])])
    ),
    useCallback: (callback) => callback,
  }
  function setter(key) {
    return (value) => {
      state[key] = value
    }
  }
  return { events, state, reload, dependencies, setter }
}

async function composer(env, overrides = {}) {
  return handler("src/features/esign/new-request-page.tsx", "submit", {
    ...env.dependencies,
    submitting: false,
    createdRequest: null,
    setAttempted: env.setter("attempted"),
    setSubmitting: env.setter("submitting"),
    setSubmitError: env.setter("error"),
    setCreatedRequest: env.setter("createdRequest"),
    problems: [],
    staged: { id: "document-1" },
    title: "Request",
    ordered: true,
    signers: [],
    saveToDrive: false,
    folder: null,
    recipients: [],
    createFn: async () => {
      env.events.push("create")
      return { id: "request-1" }
    },
    navigate: async (options) => {
      env.events.push(["navigate", options.params.requestId])
    },
    ...overrides,
  })
}

void test("creation waits for loader refresh before navigation and notification", async () => {
  const env = environment()
  const submit = await composer(env)
  const pending = submit()
  await setImmediate()
  assert.deepEqual(env.events, ["create", "reload"])
  assert.equal(env.state.submitting, true)
  env.reload.resolve()
  await pending
  assert.deepEqual(env.events, ["create", "reload", ["navigate", "request-1"], ["success", "Request created."]])
})

void test("a failed create stays retryable without navigation or a success notification", async () => {
  const env = environment()
  await (
    await composer(env, {
      createFn: async () => {
        throw new Error("Create refused")
      },
    })
  )()
  assert.equal(env.state.error, "Create refused")
  assert.equal(env.state.submitting, false)
  assert.equal(env.state.createdRequest, undefined)
  assert.deepEqual(env.events, [["logged", "Create refused"]])
})

void test("refresh and navigation failure preserve the created request without allowing another create", async () => {
  const env = environment()
  const submit = await composer(env, {
    navigate: async () => {
      throw new Error("Navigation failed")
    },
  })
  const pending = submit()
  await setImmediate()
  env.reload.reject(new Error("Refresh failed"))
  await pending
  assert.equal(env.state.createdRequest, "request-1")
  assert.equal(env.state.submitting, false)
  assert.equal(env.state.error, null)
  assert.deepEqual(env.events, [
    "create",
    "reload",
    ["logged", "Refresh failed"],
    ["logged", "Navigation failed"],
    ["success", "Request created."],
  ])
  await (
    await composer(env, { createdRequest: env.state.createdRequest })
  )()
  assert.equal(env.events.filter((event) => event === "create").length, 1)
})

for (const refreshFails of [false, true]) {
  void test(`CIE completion waits for refresh, including failure=${refreshFails}, before closing and notifying`, async () => {
    const env = environment()
    const dependencies = {
      ...env.dependencies,
      finishing: { current: false },
      setPhase: env.setter("phase"),
      popupRef: { current: {} },
      onSigned: () => env.events.push("signed"),
    }
    dependencies.reload = await handler("src/features/esign/sign-with-cie.tsx", "reload", dependencies)
    const finish = await handler("src/features/esign/sign-with-cie.tsx", "finish", dependencies)
    const pending = finish(1, 2)
    assert.deepEqual(env.events, ["reload"])
    assert.equal(env.state.phase, undefined)
    if (refreshFails) env.reload.reject(new Error("Refresh failed"))
    else env.reload.resolve()
    await pending
    assert.equal(env.state.phase, null)
    assert.equal(dependencies.popupRef.current, null)
    assert.deepEqual(env.events.slice(-2), [["warning", "1 of 2 documents signed."], "signed"])
    await finish(1, 2)
    assert.equal(env.events.filter((event) => event === "reload").length, 1)
  })
}

for (const outcome of ["delivered", "failed", "throws"]) {
  void test(`delivery retry waits for refresh before reporting ${outcome}`, async () => {
    const env = environment()
    const retry = await handler("src/features/esign/request-page.tsx", "retry", {
      ...env.dependencies,
      request: { id: "request-1" },
      setRetrying: env.setter("retrying"),
      retryFn: async () => {
        if (outcome === "throws") throw new Error("Delivery refused")
        return outcome === "failed" ? { status: "failed", error: "Mailbox refused" } : { status: "delivered" }
      },
    })
    const pending = retry()
    await setImmediate()
    assert.ok(!env.events.some((event) => Array.isArray(event) && event[0] !== "logged"))
    assert.equal(env.state.retrying, true)
    env.reload.resolve()
    await pending
    assert.equal(env.state.retrying, false)
    assert.deepEqual(
      env.events.at(-1),
      outcome === "delivered"
        ? ["success", "Document delivered."]
        : ["error", outcome === "failed" ? "Couldn't deliver the document. Mailbox refused" : "Delivery refused"]
    )
  })
}
