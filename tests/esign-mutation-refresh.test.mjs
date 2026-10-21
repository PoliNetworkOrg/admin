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
  // `read()` is how the signing hook reads its options: here, the dependencies themselves.
  return runInNewContext(`${compiled}; handler`, { read: () => dependencies, ...dependencies })
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
    setSaveView: env.setter("saveView"),
    setEmailOpen: env.setter("emailOpen"),
    saveView: "closed",
    emailOpen: false,
    problemsOpenRow: { current: false },
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
    rows: [],
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

void test("creation waits for loader refresh before navigation, and the request page says the rest", async () => {
  const env = environment()
  const { submit } = await composer(env)
  const pending = submit()
  await setImmediate()
  assert.deepEqual(env.events, ["create", "reload"])
  assert.equal(env.state.submitting, true)
  env.reload.resolve()
  await pending
  // No toast: the card says whom the request waits for and when they were emailed.
  assert.deepEqual(env.events, ["create", "reload", ["navigate", "request-1"]])
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
  // The email row opens by itself to show its problem; the save row has none and stays as it was.
  assert.equal(env.state.emailOpen, true)
  assert.equal(env.state.saveView, undefined)
})

void test("a missing folder opens the save row on the folder browser", async () => {
  const env = environment()
  const { submit } = await composer(env, { problems: true, errors: { folder: "Choose a folder." } })
  await submit()
  assert.equal(env.state.saveView, "browse")
  assert.equal(env.state.emailOpen, undefined)
  assert.deepEqual(env.events, [])
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
  assert.deepEqual(env.events, ["create", "reload", ["logged", "Refresh failed"], ["logged", "Navigation failed"]])
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

const SIGN = "src/features/esign/sign-with-cie.tsx"

for (const refreshFails of [false, true]) {
  void test(`a signature without a hand-off waits for refresh, failure=${refreshFails}, before closing and notifying`, async () => {
    const env = environment()
    const dependencies = {
      ...env.dependencies,
      finishing: { current: false },
      show: env.setter("session"),
      popupRef: { current: {} },
      onSigned: () => env.events.push("signed"),
    }
    dependencies.reload = await handler(SIGN, "reload", dependencies)
    const finish = await handler(SIGN, "finish", dependencies)
    const pending = finish(2)
    assert.deepEqual(env.events, ["reload"])
    assert.equal(env.state.session, undefined)
    if (refreshFails) env.reload.reject(new Error("Refresh failed"))
    else env.reload.resolve()
    await pending
    assert.equal(env.state.session, null)
    assert.equal(dependencies.popupRef.current, null)
    assert.deepEqual(env.events.slice(-2), [["success", "2 documents signed."], "signed"])
    await finish(2)
    assert.equal(env.events.filter((event) => event === "reload").length, 1)
  })
}

/** Timers that fire only when the test says so. */
function fakeSleep() {
  const waiting = []
  return {
    sleep: (ms) => {
      const timer = deferred()
      waiting.push({ ms, resolve: timer.resolve })
      return timer.promise
    },
    fire: async (ms) => {
      for (const timer of waiting.filter((t) => t.ms === ms)) timer.resolve()
      await setImmediate()
    },
  }
}

async function handOver(update) {
  const events = []
  const clock = fakeSleep()
  const finalFocus = () => "card body"
  const dependencies = {
    sleep: clock.sleep,
    SIGNED_MIN_MS: 1000,
    SIGNED_MAX_MS: 4000,
    finishing: { current: false },
    popupRef: { current: { close: () => events.push("popup closed") } },
    focusAfter: { current: null },
    finalFocus,
    show: (session) => events.push(["show", session]),
    onSigned: () => events.push("signed"),
    console: { error: (error) => events.push(["logged", error.message]) },
  }
  const run = await handler(SIGN, "handOver", dependencies)
  const pending = run([{ jobId: "a", requestId: "r1", title: "Verbale" }], update)
  await setImmediate()
  return { events, clock, pending, run, dependencies, finalFocus }
}

const RELEASED = ["popup closed", ["show", null], "signed"]

void test("the hand-off keeps the agent's Signed up for at least a second", async () => {
  const requested = []
  const { events, clock, pending, dependencies, finalFocus } = await handOver(async (ids) => {
    requested.push(ids)
  })
  assert.deepEqual(requested, [["r1"]])
  assert.deepEqual(events, [])
  await clock.fire(1000)
  await pending
  assert.deepEqual(events, RELEASED)
  assert.equal(dependencies.focusAfter.current, finalFocus)
})

void test("the hand-off waits for the page to update, but no longer than four seconds", async () => {
  const update = deferred()
  const slow = await handOver(() => update.promise)
  await slow.clock.fire(1000)
  assert.deepEqual(slow.events, [])
  update.resolve()
  await slow.pending
  assert.deepEqual(slow.events, RELEASED)

  const stuck = await handOver(() => new Promise(() => {}))
  await stuck.clock.fire(1000)
  assert.deepEqual(stuck.events, [])
  await stuck.clock.fire(4000)
  await stuck.pending
  assert.deepEqual(stuck.events, RELEASED)
})

void test("a failed hand-off is logged and lets go after a second", async () => {
  const { events, clock, pending, run } = await handOver(async () => {
    throw new Error("Reload failed")
  })
  assert.deepEqual(events, [["logged", "Reload failed"]])
  await clock.fire(1000)
  await pending
  assert.deepEqual(events.slice(1), RELEASED)
  await run([], async () => {})
  assert.equal(events.filter((event) => event === "signed").length, 1)
})

async function agentWindow(popup, overrides = {}) {
  const events = []
  const dependencies = {
    Date,
    popupRef: { current: popup },
    closedReads: { current: 3 },
    sessionRef: { current: { jobs: [], url: "sign-url" } },
    popupFeatures: () => "popup=yes",
    openPopup: (text) => {
      events.push(["placeholder", text])
      return { closed: false, focus: () => events.push("focused") }
    },
    go: (mode) => events.push(["mode", mode.kind]),
    load: (target, url, next) => events.push(["load", url, next, target === popup ? "same" : "new"]),
    window: {
      open: (url, name) => {
        events.push(["open", url, name])
        return { closed: false }
      },
    },
    ...overrides,
  }
  dependencies.showWindow = await handler(SIGN, "showWindow", dependencies)
  dependencies.retry = await handler(SIGN, "retry", dependencies)
  return { events, ...dependencies }
}

void test("showing the open agent window focuses it without reloading or duplicating it", async () => {
  const popup = { closed: false, location: { href: "pin-form" }, focus: () => (popup.focused = true) }
  const { events, closedReads, showWindow } = await agentWindow(popup)
  showWindow("sign-url")
  assert.equal(popup.focused, true)
  assert.equal(popup.location.href, "pin-form")
  assert.deepEqual(events, [])
  assert.equal(closedReads.current, 0)
})

void test("a closed agent window opens again under a new name", async () => {
  const { events, popupRef, showWindow } = await agentWindow({ closed: true })
  showWindow("sign-url")
  assert.equal(events[0][0], "open")
  assert.equal(events[0][1], "sign-url")
  assert.match(events[0][2], /^pn-esign-\d+$/)
  assert.equal(popupRef.current.closed, false)
})

void test("trying again reloads the signing page in the agent window, or opens one", async () => {
  const popup = { closed: false, focus: () => (popup.focused = true) }
  const open = await agentWindow(popup)
  open.retry()
  assert.deepEqual(open.events, [["load", "sign-url", "opening", "same"]])
  assert.equal(popup.focused, true)

  const closed = await agentWindow({ closed: true })
  closed.retry()
  assert.deepEqual(closed.events, [
    ["placeholder", "Opening PoliNetwork eSign…"],
    ["load", "sign-url", "opening", "new"],
    "focused",
  ])

  const blocked = await agentWindow({ closed: true }, { openPopup: () => null })
  blocked.retry()
  assert.deepEqual(blocked.events, [["mode", "blocked"]])
})

void test("the signer's own cancel closes the dialog once, without a reload", async () => {
  const env = environment()
  const popup = { close: () => env.events.push("popup closed") }
  const dismiss = await handler(SIGN, "dismiss", {
    ...env.dependencies,
    finishing: { current: false },
    show: env.setter("session"),
    popupRef: { current: popup },
    onStopped: (error) => env.events.push(["stopped", error]),
  })
  dismiss()
  dismiss()
  assert.equal(env.state.session, null)
  assert.deepEqual(env.events, ["popup closed", ["stopped", null]])
})

async function closing(mode, statuses) {
  const env = environment()
  const jobs = statuses.map(([jobId]) => ({ jobId, requestId: jobId, title: jobId }))
  const finalFocus = () => "card body"
  const dependencies = {
    ...env.dependencies,
    finishing: { current: false },
    attempt: { current: 0 },
    sessionRef: { current: { jobs, url: "sign-url" } },
    modeRef: { current: mode },
    statesRef: { current: new Map(statuses.map(([jobId, status]) => [jobId, { status }])) },
    OPEN_STATUSES: new Set(["pending", "prepared"]),
    focusAfter: { current: null },
    finalFocus,
    show: env.setter("session"),
    setClosing: env.setter("closing"),
    popupRef: { current: { close: () => env.events.push("popup closed") } },
    cancelFn: async ({ data }) => env.events.push(["cancel", data.jobIds]),
    onStopped: (error) => env.events.push(["stopped", error]),
  }
  dependencies.reload = await handler(SIGN, "reload", dependencies)
  const close = await handler(SIGN, "close", dependencies)
  return { env, close, dependencies, finalFocus }
}

for (const refreshFails of [false, true]) {
  void test(`closing an ended attempt shows it is busy until the refresh settles, failure=${refreshFails}`, async () => {
    const { env, close, dependencies, finalFocus } = await closing({ kind: "ended", ending: { reason: "expired" } }, [
      ["a", "expired"],
    ])
    const pending = close()
    assert.equal(env.state.closing, true)
    assert.equal(env.state.session, undefined)
    await setImmediate()
    assert.deepEqual(env.events, ["popup closed", "reload"])
    await close()
    assert.deepEqual(env.events, ["popup closed", "reload"])
    if (refreshFails) env.reload.reject(new Error("Refresh failed"))
    else env.reload.resolve()
    await pending
    assert.equal(env.state.session, null)
    // Still busy while the dialog fades out, so the button doesn't flash back to idle.
    assert.equal(env.state.closing, true)
    assert.equal(dependencies.focusAfter.current, finalFocus)
    assert.deepEqual(env.events.at(-1), ["stopped", null])
    assert.ok(!env.events.some((event) => event[0] === "cancel"))
  })
}

void test("cancelling a signature closes at once, cancels what's open and reloads only after a signature", async () => {
  const nothing = await closing({ kind: "signing" }, [["a", "pending"]])
  await nothing.close()
  assert.equal(nothing.env.state.session, null)
  assert.equal(nothing.env.state.closing, undefined)
  assert.equal(nothing.dependencies.focusAfter.current, null)
  assert.deepEqual(nothing.env.events, ["popup closed", ["cancel", ["a"]], ["stopped", null]])

  const some = await closing({ kind: "signing" }, [
    ["a", "completed"],
    ["b", "prepared"],
  ])
  const pending = some.close()
  await setImmediate()
  assert.equal(some.env.state.session, null)
  assert.deepEqual(some.env.events, ["popup closed", ["cancel", ["b"]], "reload"])
  some.env.reload.resolve()
  await pending
  assert.deepEqual(some.env.events.at(-1), ["stopped", null])
})

/** The dialog's reaction to polls and agent messages, with the real rules of signing-state.ts. */
async function signingMachine(mode, overrides = {}) {
  const { closedWindowAction, outcomeOf, stateForFatal } = await import("../src/features/esign/signing-state.ts")
  const events = []
  const flags = []
  const dependencies = {
    Date,
    sessionRef: { current: { jobs: [{ jobId: "a", requestId: "r1", title: "Verbale" }], url: "sign-url" } },
    modeRef: { current: mode },
    finishing: { current: false },
    SETTLED: new Set(["ended", "signed", "partial"]),
    statesRef: { current: new Map() },
    setStates: () => {},
    outcomeOf,
    closedWindowAction,
    stateForFatal,
    preparingRef: { current: false },
    readySeen: { current: false },
    handOff: undefined,
    handOver: () => events.push("hand-off"),
    finish: () => events.push("finish"),
    dismiss: () => events.push("dismiss"),
    close: () => events.push("close"),
    popupRef: { current: { close: () => events.push("popup closed") } },
    fatalShown: { current: false },
    seenCounts: { current: true },
    answered: { current: false },
    fatal: { current: null },
    closedReads: { current: 0 },
    CLOSED_READS: 2,
    CLOSED_RECHECK_MS: 400,
    sleep: (ms) => {
      events.push(["recheck in", ms])
      return new Promise(() => {})
    },
    poll: () => {},
    writeAgentFlag: (version) => flags.push(version),
    ...overrides,
  }
  dependencies.go = (next) => {
    dependencies.modeRef.current = next
    events.push(next.kind === "fatal" ? ["fatal", next.state, next.message] : next.kind)
  }
  dependencies.answer = await handler(SIGN, "answer", dependencies)
  const track = await handler(SIGN, "track", dependencies)
  const onMessage = await handler(SIGN, "onMessage", dependencies)
  const status = (status, extra = {}) => [
    { jobId: "a", status, errorCode: null, errorMessage: null, seen: true, ...extra },
  ]
  return { track, onMessage, status, events, flags, dependencies }
}

const OPENING = { kind: "opening", deadline: 1 }

void test("a ready agent is remembered with its version, which the job fetch after it doesn't overwrite", async () => {
  const { track, onMessage, status, events, flags } = await signingMachine(OPENING)
  onMessage({ type: "pn-esign", status: "ready", detail: "0.4.0" })
  assert.deepEqual(events, ["signing"])
  track(status("pending"), false, Date.now())
  assert.deepEqual(flags, ["0.4.0"])
})

void test("an agent too old to say ready is known by its job fetch, unless the job was fetched before", async () => {
  const old = await signingMachine(OPENING)
  old.track(old.status("pending", { seen: false }), false, Date.now())
  assert.deepEqual(old.events, [])
  old.track(old.status("pending"), false, Date.now())
  assert.deepEqual(old.events, ["signing"])
  assert.deepEqual(old.flags, [null])

  const reloaded = await signingMachine(OPENING, { seenCounts: { current: false } })
  reloaded.track(reloaded.status("pending"), false, Date.now())
  assert.deepEqual(reloaded.events, [])
})

void test("a fatal error waits for the next poll, which may show the job's own end", async () => {
  const ended = await signingMachine({ kind: "signing" }, { answered: { current: true } })
  const before = Date.now() - 1
  ended.onMessage({ type: "pn-esign", status: "error", detail: "job_done", message: "Nothing to sign.", fatal: true })
  assert.deepEqual(ended.events, [])
  // A poll that started before the message says nothing about it.
  ended.track(ended.status("pending"), false, before)
  assert.deepEqual(ended.events, [])
  ended.track(ended.status("failed", { errorCode: "job_done" }), false, Date.now() + 1)
  assert.equal(ended.events[0], "ended")
  assert.equal(ended.dependencies.modeRef.current.ending.title, "Nothing left to sign")

  const open = await signingMachine({ kind: "signing" })
  open.onMessage({ type: "pn-esign", status: "error", detail: "ticket_invalid", message: "Bad link.", fatal: true })
  open.track(open.status("pending"), false, Date.now() + 1)
  assert.deepEqual(open.events, [["fatal", "continue", "Bad link."]])
})

void test("an outdated agent, a lost connection and a timed-out window show at once", async () => {
  for (const [code, state] of [
    ["agent_outdated", "outdated"],
    ["backend_unreachable", "connect"],
    ["job_expired", "expired"],
  ]) {
    const { onMessage, events } = await signingMachine(OPENING)
    onMessage({ type: "pn-esign", status: "error", detail: code, message: "From the agent.", fatal: true })
    assert.deepEqual(events, [["fatal", state, "From the agent."]], code)
  }
})

void test("an outdated agent's window closes only when it couldn't explain the update itself", async () => {
  const outdated = (machine) => machine.status("failed", { errorCode: "agent_outdated" })
  const explained = await signingMachine(
    { kind: "fatal", state: "outdated", message: "" },
    { fatalShown: { current: true } }
  )
  explained.track(outdated(explained), false, Date.now())
  assert.deepEqual(explained.events, ["ended"])
  const silent = await signingMachine({ kind: "signing" })
  silent.track(outdated(silent), false, Date.now())
  assert.deepEqual(silent.events, ["popup closed", "ended"])
})

void test("someone else ending the request closes the agent window", async () => {
  const { track, status, events } = await signingMachine({ kind: "signing" })
  track(status("cancelled", { errorCode: "request_cancelled", errorMessage: "Anna cancelled." }), false, Date.now())
  assert.deepEqual(events, ["popup closed", "ended"])
})

void test("a window closed after the agent answered is acted on after two polls", async () => {
  const cancelled = await signingMachine({ kind: "signing" }, { answered: { current: true } })
  cancelled.track(cancelled.status("pending"), true, Date.now())
  // The second read comes sooner than the next regular poll.
  assert.deepEqual(cancelled.events, [["recheck in", 400]])
  cancelled.track(cancelled.status("pending"), true, Date.now())
  assert.deepEqual(cancelled.events, [["recheck in", 400], "close"])

  const working = await signingMachine({ kind: "signing" }, { answered: { current: true } })
  working.track(working.status("prepared"), true, Date.now())
  working.track(working.status("prepared"), true, Date.now())
  assert.deepEqual(working.events, [["recheck in", 400]])

  // A window open again between two closed reads starts the count over.
  const reopened = await signingMachine({ kind: "signing" }, { answered: { current: true } })
  reopened.track(reopened.status("pending"), true, Date.now())
  reopened.track(reopened.status("pending"), false, Date.now())
  reopened.track(reopened.status("pending"), true, Date.now())
  assert.deepEqual(reopened.events, [
    ["recheck in", 400],
    ["recheck in", 400],
  ])
})

void test("the agent stopping after it answered is the one outcome the dialog learns from a message", async () => {
  const lost = { type: "pn-esign", status: "error", detail: "agent_unreachable" }
  const answered = await signingMachine({ kind: "signing" }, { answered: { current: true } })
  answered.onMessage(lost)
  assert.deepEqual(answered.events, ["stopped"])
  const silent = await signingMachine(OPENING)
  silent.onMessage(lost)
  assert.deepEqual(silent.events, [])
})

void test("every document signed hands off, or reloads when nothing hands off", async () => {
  const plain = await signingMachine({ kind: "signing" })
  plain.track(plain.status("completed"), false, Date.now())
  assert.deepEqual(plain.events, ["signed", "finish"])
  const handing = await signingMachine({ kind: "signing" }, { handOff: async () => {} })
  handing.track(handing.status("completed"), false, Date.now())
  assert.deepEqual(handing.events, ["signed", "hand-off"])
  // The count stays with the state, so the title doesn't change as the dialog closes without its jobs.
  assert.deepEqual({ ...handing.dependencies.modeRef.current }, { kind: "signed", total: 1 })
  // Settled: later polls change nothing.
  handing.track(handing.status("completed"), false, Date.now())
  assert.deepEqual(handing.events, ["signed", "hand-off"])
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
    // The card's delivery lines and alert say how a retry that ran went; only a call that throws needs a toast.
    assert.deepEqual(
      env.events.filter((event) => Array.isArray(event) && event[0] !== "logged"),
      outcome === "throws" ? [["error", "Delivery refused"]] : []
    )
    assert.deepEqual(env.events.at(-1), outcome === "throws" ? ["error", "Delivery refused"] : "reload")
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
