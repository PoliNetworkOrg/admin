import assert from "node:assert/strict"
import { once } from "node:events"
import { createServer } from "node:http"
import { PassThrough } from "node:stream"
import test from "node:test"

import { SignInRequired } from "../src/mcp/client/auth.ts"
import { runBridge } from "../src/mcp/client/bridge.ts"
import { MCP_ID_TOKEN_HEADER, MCP_PATH, MCP_REFRESH_TOOL } from "../src/mcp/protocol.ts"

const TOKENS = { accessToken: "access-1", idToken: "id-1" }

/** A fake admin: `handle(message, request)` returns [status, body] (body null for none) or "destroy". */
async function fakeAdmin(t, handle) {
  const received = []
  const server = createServer(async (request, reply) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const text = Buffer.concat(chunks).toString("utf8")
    const entry = { url: request.url, headers: request.headers, text, message: JSON.parse(text) }
    received.push(entry)
    const answer = await handle(entry.message, entry)
    if (answer === "destroy") {
      request.socket.destroy()
      return
    }
    const [status, body] = answer
    if (body === null) {
      reply.writeHead(status).end()
      return
    }
    reply.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return { origin: `http://127.0.0.1:${server.address().port}`, received }
}

/** Runs the bridge with in-memory stdio; `next()` resolves with the next line it writes. */
function bridge(origin, credentials = async () => TOKENS, timeouts) {
  const input = new PassThrough()
  const output = new PassThrough()
  const lines = []
  const waiters = []
  let buffer = ""
  output.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    for (let end = buffer.indexOf("\n"); end !== -1; end = buffer.indexOf("\n")) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      const waiter = waiters.shift()
      if (waiter) waiter(message)
      else lines.push(message)
    }
  })
  const done = runBridge({ origin, credentials, input, output, userAgent: "polinetwork-admin-mcp/test", timeouts })
  return {
    send: (message) => input.write(`${JSON.stringify(message)}\n`),
    write: (bytes) => input.write(bytes),
    next: () => (lines.length > 0 ? Promise.resolve(lines.shift()) : new Promise((resolve) => waiters.push(resolve))),
    pending: () => lines,
    close: async () => {
      input.end()
      await done
    },
  }
}

const result = (message, value) => [200, { jsonrpc: "2.0", id: message.id, result: value }]

void test("forwards with the user's tokens and echoes the negotiated protocol version", async (t) => {
  const admin = await fakeAdmin(t, (message) =>
    message.method === "initialize"
      ? result(message, { protocolVersion: "2025-06-18" })
      : result(message, { tools: [] })
  )
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } })
  client.send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  assert.deepEqual((await client.next()).result, { tools: [] })
  await client.close()

  const [initialize, list] = admin.received
  assert.equal(initialize.url, MCP_PATH)
  assert.equal(initialize.headers.authorization, "Bearer access-1")
  assert.equal(initialize.headers[MCP_ID_TOKEN_HEADER], "id-1")
  assert.equal(initialize.headers["content-type"], "application/json")
  assert.equal(initialize.headers.accept, "application/json, text/event-stream")
  assert.equal(initialize.headers["user-agent"], "polinetwork-admin-mcp/test")
  assert.equal(initialize.headers.cookie, undefined)
  assert.equal(initialize.headers["mcp-protocol-version"], undefined)
  assert.equal(list.headers["mcp-protocol-version"], "2025-06-18")
})

void test("runs messages concurrently: a slow call never holds back the next", async (t) => {
  let release
  const slow = new Promise((resolve) => (release = resolve))
  const admin = await fakeAdmin(t, async (message) => {
    if (message.id === 1) await slow
    return result(message, { id: message.id })
  })
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "run_read" } })
  client.send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  assert.equal((await client.next()).id, 2)
  release()
  assert.equal((await client.next()).id, 1)
  await client.close()
})

void test("writes nothing for 202 and one line per response of a batch", async (t) => {
  const admin = await fakeAdmin(t, (message) =>
    Array.isArray(message) ? [200, message.map((entry) => ({ jsonrpc: "2.0", id: entry.id, result: {} }))] : [202, null]
  )
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", method: "notifications/initialized" })
  client.send([
    { jsonrpc: "2.0", id: "a", method: "ping" },
    { jsonrpc: "2.0", id: "b", method: "ping" },
  ])
  assert.deepEqual([(await client.next()).id, (await client.next()).id], ["a", "b"])
  await client.close()
  assert.deepEqual(client.pending(), [])
  assert.equal(admin.received.length, 2)
})

void test("a refused token is renewed once and the message resent", async (t) => {
  const admin = await fakeAdmin(t, (message, request) =>
    request.headers.authorization === "Bearer access-2"
      ? result(message, { ok: true })
      : [401, { jsonrpc: "2.0", id: null, error: { code: -32401, message: "expired" } }]
  )
  const rejected = []
  const client = bridge(admin.origin, async (token) => {
    if (token === undefined) return TOKENS
    rejected.push(token)
    return { accessToken: "access-2", idToken: "id-2" }
  })
  client.send({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "run_write" } })
  assert.deepEqual((await client.next()).result, { ok: true })
  await client.close()
  assert.deepEqual(rejected, ["access-1"])
  assert.equal(admin.received.length, 2)
  assert.equal(admin.received[1].headers[MCP_ID_TOKEN_HEADER], "id-2")
})

void test("a session the admin keeps refusing asks the user to log in, and initialize is still answered", async (t) => {
  const admin = await fakeAdmin(t, () => [401, { jsonrpc: "2.0", id: null, error: { code: -32401, message: "no" } }])
  const client = bridge(admin.origin, async (token) => (token ? { accessToken: "access-2", idToken: "id-2" } : TOKENS))
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  const refused = await client.next()
  assert.equal(refused.error.code, -32001)
  assert.match(refused.error.message, /polinetwork-admin-mcp login/)
  client.send({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-03-26" } })
  const initialized = await client.next()
  assert.equal(initialized.result.protocolVersion, "2025-03-26")
  assert.equal(initialized.result.serverInfo.name, "polinetwork-admin")
  await client.close()
})

void test("without credentials it answers initialize and ping itself and asks for login otherwise", async (t) => {
  const admin = await fakeAdmin(t, (message) => result(message, {}))
  const client = bridge(admin.origin, async () => {
    throw new SignInRequired("Not signed in. Run `polinetwork-admin-mcp login`.")
  })
  client.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } })
  const initialized = await client.next()
  assert.equal(initialized.result.protocolVersion, "2025-11-25")
  assert.deepEqual(initialized.result.capabilities, { tools: { listChanged: true } })
  assert.match(initialized.result.instructions, /login/)
  client.send({ jsonrpc: "2.0", method: "notifications/initialized" })
  client.send({ jsonrpc: "2.0", id: 2, method: "ping" })
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", id: 2, result: {} })
  client.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami" } })
  assert.equal((await client.next()).error.code, -32001)
  await client.close()
  assert.equal(admin.received.length, 0)
})

void test("a tool call cut off by the network is not resent; other methods are retried once", async (t) => {
  const admin = await fakeAdmin(t, (message, request) =>
    message.method === "tools/list" && admin.received.indexOf(request) > 1 ? result(message, { tools: [] }) : "destroy"
  )
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "run_write" } })
  const failed = await client.next()
  assert.equal(failed.id, 1)
  assert.match(failed.error.message, /may have run anyway/)
  assert.equal(admin.received.length, 1)
  client.send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  assert.deepEqual((await client.next()).result, { tools: [] })
  assert.equal(admin.received.length, 3)
  await client.close()
})

void test("a timed-out tool call says the change may have happened", async (t) => {
  const admin = await fakeAdmin(t, () => new Promise(() => {}))
  const client = bridge(admin.origin, undefined, { call: 200, other: 200 })
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "run_write" } })
  const failed = await client.next()
  assert.match(failed.error.message, /did not answer within 0.2 seconds.*may have run anyway/)
  assert.equal(admin.received.length, 1)
  await client.close()
})

void test("announces a new tool list after permissions are refreshed", async (t) => {
  const admin = await fakeAdmin(t, (message) =>
    result(message, { content: [], isError: message.params.arguments?.fail === true })
  )
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: MCP_REFRESH_TOOL, arguments: {} } })
  assert.equal((await client.next()).id, 1)
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", method: "notifications/tools/list_changed" })
  client.send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "whoami" } })
  client.send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: MCP_REFRESH_TOOL, arguments: { fail: true } },
  })
  const ids = [(await client.next()).id, (await client.next()).id].toSorted((a, b) => a - b)
  assert.deepEqual(ids, [2, 3])
  await client.close()
  assert.deepEqual(client.pending(), [])
})

void test("carries large messages intact and puts the admin's errors on the request", async (t) => {
  const admin = await fakeAdmin(t, (message) =>
    message.method === "tools/call"
      ? result(message, { length: message.params.arguments.input.base64.length })
      : [403, { jsonrpc: "2.0", id: null, error: { code: -32403, message: "No dashboard access." } }]
  )
  const client = bridge(admin.origin)
  const base64 = "A".repeat(12 * 1024 * 1024)
  client.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "run_write", arguments: { input: { base64 } } },
  })
  assert.deepEqual((await client.next()).result, { length: base64.length })
  client.send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  assert.deepEqual(await client.next(), {
    jsonrpc: "2.0",
    id: 2,
    error: { code: -32000, message: "No dashboard access." },
  })
  await client.close()
})

void test("answers what is in flight before stopping when the client closes stdin", async (t) => {
  const admin = await fakeAdmin(t, async (message) => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return result(message, {})
  })
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  await client.close()
  assert.deepEqual(client.pending(), [{ jsonrpc: "2.0", id: 1, result: {} }])
})

void test("refuses a message larger than the admin accepts without sending it", async (t) => {
  const admin = await fakeAdmin(t, (message) => result(message, {}))
  const client = bridge(admin.origin)
  const huge = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { padding: "x".repeat(49 * 1024 * 1024) },
  })
  // Written in pieces, as a pipe delivers it.
  const input = Buffer.from(`${huge}\n`)
  for (let start = 0; start < input.length; start += 1024 * 1024)
    client.write(input.subarray(start, start + 1024 * 1024))
  const refused = await client.next()
  assert.match(refused.error.message, /larger than the admin accepts/)
  client.send({ jsonrpc: "2.0", id: 2, method: "ping" })
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", id: 2, result: {} })
  await client.close()
  assert.equal(admin.received.length, 1)
})

void test("passes on only the answers to the requests it sent, one each", async (t) => {
  const admin = await fakeAdmin(t, (message) => [
    200,
    [
      // What a compromised admin could try: calling the client, notifying it, answering what nobody asked.
      { jsonrpc: "2.0", id: 99, method: "sampling/createMessage", params: { messages: [] } },
      { jsonrpc: "2.0", id: message.id, method: "roots/list" },
      { jsonrpc: "2.0", method: "notifications/tools/list_changed" },
      { jsonrpc: "2.0", id: 12345, result: { stray: true } },
      { jsonrpc: "2.0", id: message.id, result: { ok: true } },
      { jsonrpc: "2.0", id: message.id, result: { ok: "again" } },
    ],
  ])
  const client = bridge(admin.origin)
  client.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", id: 1, result: { ok: true } })
  await client.close()
  assert.deepEqual(client.pending(), [])
})

void test("a request the admin leaves unanswered gets an error instead of hanging", async (t) => {
  const admin = await fakeAdmin(t, (message) => [200, [{ jsonrpc: "2.0", id: message[0].id, result: {} }]])
  const client = bridge(admin.origin)
  client.send([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "run_write" } },
  ])
  assert.deepEqual(await client.next(), { jsonrpc: "2.0", id: 1, result: {} })
  const missing = await client.next()
  assert.equal(missing.id, 2)
  assert.match(missing.error.message, /did not answer.*may have run anyway/)
  await client.close()
  assert.deepEqual(client.pending(), [])
})
