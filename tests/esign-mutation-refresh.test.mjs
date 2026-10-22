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
  const compiled = ts.transpileModule(`const handler = ${found.getText().replace(/^export /, "")}`, {
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
  const path = "src/features/esign/new-request-page.tsx"
  const dependencies = {
    ...env.dependencies,
    submitting: false,
    created: { current: null },
    creating: { current: false },
    setAttempted: env.setter("attempted"),
    setShown: env.setter("shown"),
    setBlockedSubmits: (update) => {
      env.state.blockedSubmits = update(env.state.blockedSubmits ?? 0)
    },
    setSubmitting: env.setter("submitting"),
    setSubmitError: env.setter("error"),
    setCreatedRequest: env.setter("createdRequest"),
    problems: false,
    errors: {},
    staged: { id: "document-1" },
    title: "Request",
    ordered: true,
    signers: [],
    saveToDrive: false,
    folder: null,
    recipients: [],
    createFn: async () => {
      env.events.push("create")
      return { id: "request-1", title: "Request" }
    },
    navigate: async (options) => {
      env.events.push(["navigate", options.params.requestId])
    },
    ...overrides,
  }
  dependencies.create = await handler(path, "create", dependencies)
  dependencies.showProblems = await handler(path, "showProblems", dependencies)
  dependencies.openRequest = await handler(path, "openRequest", dependencies)
  return {
    submit: await handler(path, "submit", dependencies),
    createAndSign: await handler(path, "createAndSign", dependencies),
    signingStopped: await handler(path, "signingStopped", dependencies),
    dependencies,
  }
}

void test("creation waits for loader refresh before navigation and notification", async () => {
  const env = environment()
  const { submit } = await composer(env)
  const pending = submit()
  await setImmediate()
  assert.deepEqual(env.events, ["create", "reload"])
  assert.equal(env.state.submitting, true)
  env.reload.resolve()
  await pending
  assert.deepEqual(env.events, ["create", "reload", ["navigate", "request-1"], ["success", "Request created."]])
})

void test("a blocked submit shows every problem without creating or reloading", async () => {
  const env = environment()
  const errors = { title: "Give the request a title.", fileName: undefined, email: "“x” isn't an email address." }
  const { submit, createAndSign } = await composer(env, { problems: true, errors })
  await submit()
  assert.equal(createAndSign(), null)
  assert.deepEqual(env.events, [])
  assert.equal(env.state.attempted, true)
  assert.deepEqual({ ...env.state.shown }, errors)
  assert.equal(env.state.blockedSubmits, 2)
})

void test("a failed create stays retryable without navigation or a success notification", async () => {
  const env = environment()
  const { submit } = await composer(env, {
    createFn: async () => {
      throw new Error("Create refused")
    },
  })
  await submit()
  assert.equal(env.state.error, "Create refused")
  assert.equal(env.state.submitting, false)
  assert.equal(env.state.createdRequest, undefined)
  assert.deepEqual(env.events, [["logged", "Create refused"]])
})

void test("refresh and navigation failure preserve the created request without allowing another create", async () => {
  const env = environment()
  const { submit } = await composer(env, {
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
  await submit()
  assert.equal(env.events.filter((event) => event === "create").length, 1)
})

void test("create-and-sign waits for refreshed loaders and reuses its created request", async () => {
  const env = environment()
  const { createAndSign, dependencies } = await composer(env)
  const pending = createAndSign()
  await setImmediate()
  assert.deepEqual(env.events, ["create", "reload"])
  assert.equal(env.state.createdRequest, "request-1")
  assert.equal(createAndSign(), null)
  env.reload.resolve()
  const items = await pending
  assert.equal(items[0].requestId, "request-1")
  assert.equal(items[0].title, "Request")
  assert.equal((await dependencies.create("other-document")).id, "request-1")
  assert.deepEqual(env.events, ["create", "reload"])
})

void test("overlapping submit and create-and-sign never create duplicate requests", async () => {
  const env = environment()
  const network = deferred()
  const { submit, createAndSign } = await composer(env, {
    createFn: async () => {
      env.events.push("create")
      return network.promise
    },
  })
  const pending = submit()
  assert.deepEqual(Array.from(await createAndSign()), [])
  assert.deepEqual(env.events, ["create"])
  network.resolve({ id: "request-1", title: "Request" })
  await setImmediate()
  env.reload.resolve()
  await pending
  assert.equal(env.events.filter((event) => event === "create").length, 1)
})

void test("create-and-sign remains retryable when creation fails", async () => {
  const env = environment()
  let calls = 0
  const { createAndSign } = await composer(env, {
    createFn: async () => {
      if (++calls === 1) throw new Error("Create refused")
      return { id: "request-1", title: "Request" }
    },
  })
  assert.deepEqual(Array.from(await createAndSign()), [])
  assert.equal(env.state.error, "Create refused")
  assert.equal(env.state.createdRequest, undefined)
  const pending = createAndSign()
  await setImmediate()
  env.reload.resolve()
  assert.equal((await pending)[0].requestId, "request-1")
  assert.equal(env.state.error, null)
  assert.equal(calls, 2)
})

for (const failure of [null, "Agent unavailable"]) {
  void test(`stopped signing retains a created request after refresh and navigation failures: ${failure}`, async () => {
    const env = environment()
    const { createAndSign, signingStopped } = await composer(env, {
      navigate: async () => {
        throw new Error("Navigation failed")
      },
    })
    const pending = createAndSign()
    await setImmediate()
    assert.deepEqual(env.events, ["create", "reload"])
    env.reload.reject(new Error("Refresh failed"))
    assert.equal((await pending)[0].requestId, "request-1")
    await signingStopped(failure)
    assert.equal(env.state.createdRequest, "request-1")
    assert.equal(env.state.error, null)
    assert.deepEqual(env.events.at(-2), ["logged", "Navigation failed"])
    assert.deepEqual(
      env.events.at(-1),
      failure
        ? ["error", "Request created, but the signature couldn't start. Agent unavailable"]
        : ["success", "Request created. Sign it here when you're ready."]
    )
    assert.equal(createAndSign(), null)
  })
}

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

async function agentWindow(popup) {
  const events = []
  const dependencies = {
    Date,
    popupRef: { current: popup },
    popupFeatures: () => "popup=yes",
    window: {
      open: (url, name) => {
        events.push(["open", url, name])
        return { closed: false }
      },
    },
    setWindowClosed: (closed) => events.push(["closed", closed]),
    setAgentLost: (lost) => events.push(["lost", lost]),
  }
  const path = "src/features/esign/sign-with-cie.tsx"
  dependencies.showWindow = await handler(path, "showWindow", dependencies)
  dependencies.openWindowAgain = await handler(path, "openWindowAgain", dependencies)
  return { events, ...dependencies }
}

void test("showing the open agent window focuses it without reloading or duplicating it", async () => {
  const popup = { closed: false, location: { href: "pin-form" }, focus: () => (popup.focused = true) }
  const { events, showWindow } = await agentWindow(popup)
  showWindow("sign-url")
  assert.equal(popup.focused, true)
  assert.equal(popup.location.href, "pin-form")
  assert.deepEqual(events, [["closed", false]])
})

void test("a closed agent window opens again under a new name", async () => {
  const { events, popupRef, showWindow } = await agentWindow({ closed: true })
  showWindow("sign-url")
  assert.equal(events[0][0], "open")
  assert.equal(events[0][1], "sign-url")
  assert.match(events[0][2], /^pn-esign-\d+$/)
  assert.equal(popupRef.current.closed, false)
})

void test("opening the window again reloads the signing page in the open agent window", async () => {
  const popup = { closed: false, location: { href: "error-page" }, focus: () => (popup.focused = true) }
  const { events, openWindowAgain } = await agentWindow(popup)
  openWindowAgain("sign-url")
  assert.equal(popup.location.href, "sign-url")
  assert.equal(popup.focused, true)
  assert.deepEqual(events, [
    ["closed", false],
    ["lost", false],
  ])
})

void test("the signer's own cancel closes the dialog once, without a reload", async () => {
  const env = environment()
  const popup = { close: () => env.events.push("popup closed") }
  const dismiss = await handler("src/features/esign/sign-with-cie.tsx", "dismiss", {
    ...env.dependencies,
    finishing: { current: false },
    setPhase: env.setter("phase"),
    popupRef: { current: popup },
    onStopped: (error) => env.events.push(["stopped", error]),
  })
  dismiss()
  dismiss()
  assert.equal(env.state.phase, null)
  assert.deepEqual(env.events, ["popup closed", ["stopped", null]])
})

for (const refreshFails of [false, true]) {
  void test(`closing an ended attempt shows it is busy until the refresh settles, failure=${refreshFails}`, async () => {
    const env = environment()
    const dependencies = {
      ...env.dependencies,
      finishing: { current: false },
      phase: { kind: "ended", reason: "expired", code: null, message: "The link expired." },
      states: new Map(),
      setPhase: env.setter("phase"),
      setClosing: env.setter("closing"),
      popupRef: { current: { close: () => env.events.push("popup closed") } },
      cancelFn: async () => env.events.push("cancel"),
      onStopped: (error) => env.events.push(["stopped", error]),
    }
    dependencies.reload = await handler("src/features/esign/sign-with-cie.tsx", "reload", dependencies)
    const close = await handler("src/features/esign/sign-with-cie.tsx", "close", dependencies)
    const pending = close()
    assert.equal(env.state.closing, true)
    assert.equal(env.state.phase, undefined)
    assert.deepEqual(env.events, ["popup closed", "reload"])
    await close()
    assert.deepEqual(env.events, ["popup closed", "reload"])
    if (refreshFails) env.reload.reject(new Error("Refresh failed"))
    else env.reload.resolve()
    await pending
    assert.equal(env.state.phase, null)
    // Still busy while the dialog fades out, so the button doesn't flash back to idle.
    assert.equal(env.state.closing, true)
    assert.deepEqual(env.events.at(-1), ["stopped", null])
    assert.ok(!env.events.includes("cancel"))
  })
}

async function endingOf() {
  const path = "src/features/esign/sign-with-cie.tsx"
  const AGENT_ERRORS = await handler(path, "AGENT_ERRORS", {})
  return handler(path, "endingOf", { AGENT_ERRORS })
}

function jobStatus(jobId, status, errorCode = null, errorMessage = null) {
  return { jobId, status, errorCode, errorMessage, seen: true }
}

void test("an attempt ends quietly only when the signer cancelled every job", async () => {
  const ending = await endingOf()
  const jobs = [{ jobId: "a", requestId: "r", title: "Verbale" }]
  assert.equal(ending([jobStatus("a", "cancelled", "pin_incorrect", "Wrong PIN.")], jobs, false), null)
  const declined = ending(
    [jobStatus("a", "cancelled", "request_declined", "Mario Rossi declined this request.")],
    jobs,
    false
  )
  assert.equal(declined.reason, "declined")
  assert.equal(declined.message, "Mario Rossi declined this request.")
  const failed = ending([jobStatus("a", "failed", "pin_locked", "PIN blocked")], jobs, false)
  assert.equal(failed.reason, "failed")
  assert.equal(failed.code, "pin_locked")
  assert.match(failed.message, /^The PIN is blocked\./)
  // A code reserved for cancels and declines counts only on a cancelled job, as in the backend.
  const reserved = ending([jobStatus("a", "failed", "request_cancelled", "Cancelled.")], jobs, false)
  assert.equal(reserved.reason, "failed")
})

void test("an attempt the backend ended is worded for the dashboard, not the agent window", async () => {
  const ending = await endingOf()
  const jobs = [{ jobId: "a", requestId: "r", title: "Verbale" }]
  for (const [code, message] of [
    ["document_changed", "Someone else signed in the meantime. Start again from the dashboard."],
    ["job_done", "This request no longer needs your signature"],
  ]) {
    const failed = ending([jobStatus("a", "failed", code, message)], jobs, false)
    assert.equal(failed.reason, "failed")
    assert.notEqual(failed.message, message)
    assert.doesNotMatch(failed.message, /dashboard/)
  }
})

void test("an ended batch names the document, and an expired link points where to sign again", async () => {
  const ending = await endingOf()
  const jobs = [
    { jobId: "a", requestId: "r1", title: "Verbale" },
    { jobId: "b", requestId: "r2", title: "Contratto" },
  ]
  const cancelled = ending(
    [
      jobStatus("a", "cancelled"),
      jobStatus("b", "cancelled", "request_cancelled", "Anna Bianchi cancelled this request."),
    ],
    jobs,
    false
  )
  assert.equal(cancelled.reason, "cancelled")
  assert.equal(cancelled.message, "Contratto: Anna Bianchi cancelled this request.")
  const statuses = [jobStatus("a", "expired"), jobStatus("b", "cancelled")]
  assert.match(ending(statuses, jobs, false).message, /Start again/)
  assert.match(ending(statuses, jobs, true).message, /^Close to open the request/)
})

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

void test("background reloads run one at a time, only while active and the tab is visible", async () => {
  const timers = new Map()
  const reloads = []
  const logged = []
  let cleanup
  const dependencies = {
    useRouter: () => ({
      invalidate: () => {
        const reload = deferred()
        reloads.push(reload)
        return reload.promise
      },
    }),
    useEffect: (effect) => {
      cleanup = effect()
    },
    window: {
      setInterval: (tick, ms) => timers.set(timers.size + 1, { tick, ms }).size,
      clearInterval: (id) => timers.delete(id),
    },
    document: { visibilityState: "visible" },
    console: { error: (error) => logged.push(error.message) },
  }
  const useReloadWhile = await handler("src/features/esign/use-reload-while.ts", "useReloadWhile", dependencies)

  useReloadWhile(false, 3000)
  assert.equal(timers.size, 0)

  useReloadWhile(true, 3000)
  const [timer] = timers.values()
  assert.equal(timer.ms, 3000)
  timer.tick()
  timer.tick()
  assert.equal(reloads.length, 1)
  reloads[0].reject(new Error("Reload failed"))
  await setImmediate()
  assert.deepEqual(logged, ["Reload failed"])

  dependencies.document.visibilityState = "hidden"
  timer.tick()
  assert.equal(reloads.length, 1)
  dependencies.document.visibilityState = "visible"
  timer.tick()
  assert.equal(reloads.length, 2)

  cleanup()
  assert.equal(timers.size, 0)
})
