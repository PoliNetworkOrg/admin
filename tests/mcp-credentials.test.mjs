import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { once } from "node:events"
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"

import { AdminMcpAuth, SignInRequired } from "../src/mcp/client/auth.ts"

const ADMIN = "https://admin.example.org"
const posix = process.platform !== "win32"

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), "admin-mcp-credentials-"))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

/** A fake PoliNetwork Auth: discovery and a refresh-token endpoint that rotates the refresh token. */
async function fakeIdp(t, { fail = false } = {}) {
  const grants = []
  const server = createServer(async (request, reply) => {
    const issuer = `http://127.0.0.1:${server.address().port}/api/auth`
    if (request.url === "/api/auth/.well-known/openid-configuration") {
      reply.writeHead(200, { "content-type": "application/json" })
      reply.end(
        JSON.stringify({ issuer, token_endpoint: `${issuer}/token`, authorization_endpoint: `${issuer}/authorize` })
      )
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"))
    grants.push(Object.fromEntries(form))
    // Slow enough that concurrent callers overlap.
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (fail) {
      reply.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_grant" }))
      return
    }
    reply.writeHead(200, { "content-type": "application/json" })
    reply.end(
      JSON.stringify({
        access_token: `access-${grants.length + 1}`,
        refresh_token: `refresh-${grants.length + 1}`,
        token_type: "Bearer",
        expires_in: 600,
      })
    )
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return { issuer: `http://127.0.0.1:${server.address().port}/api/auth`, grants }
}

function session(overrides = {}) {
  return {
    origin: ADMIN,
    config: {
      clientId: "admin-mcp",
      issuer: "https://auth.example.org/api/auth",
      resource: "https://backend.example.org",
      scope: "openid profile email offline_access backend:admin",
    },
    sub: "user-1",
    name: "Ada",
    email: "ada@example.org",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    idToken: "id-1",
    expiresAt: Date.now() + 10 * 60_000,
    refreshing: false,
    ...overrides,
  }
}

async function store(path, value, mode = 0o600) {
  const auth = new AdminMcpAuth(ADMIN, path)
  await mkdir(path, { recursive: true, mode: 0o700 })
  await writeFile(auth.file, JSON.stringify(value), { mode })
  if (posix) await chmod(auth.file, mode)
  return auth
}

void test("reads valid credentials without contacting PoliNetwork Auth", async (t) => {
  const auth = await store(await directory(t), session())
  assert.deepEqual(await auth.credentials(), { accessToken: "access-1", idToken: "id-1" })
})

void test("asks for login when there are no credentials, or when they are unsafe or invalid", async (t) => {
  const path = await directory(t)
  const auth = new AdminMcpAuth(ADMIN, path)
  await assert.rejects(
    auth.credentials(),
    (error) => error instanceof SignInRequired && /Not signed in/.test(error.message)
  )

  await store(path, { ...session(), origin: "https://other.example.org" })
  await assert.rejects(auth.credentials(), SignInRequired)

  if (posix) {
    await store(path, session(), 0o644)
    await assert.rejects(auth.credentials(), /mode 0600/)

    await rm(auth.file)
    const real = join(path, "elsewhere.json")
    await writeFile(real, JSON.stringify(session()), { mode: 0o600 })
    await symlink(real, auth.file)
    await assert.rejects(auth.credentials(), /not a credential file/)
  }
})

void test("refreshes an expired token once for every caller, then saves it privately", async (t) => {
  const idp = await fakeIdp(t)
  const path = await directory(t)
  const expired = session({ expiresAt: Date.now() - 1000, config: { ...session().config, issuer: idp.issuer } })
  const first = await store(path, expired)
  // Two clients' processes sharing the store: each instance takes the same lock directory.
  const second = new AdminMcpAuth(ADMIN, path)
  const results = await Promise.all([first.credentials(), second.credentials(), first.credentials()])
  assert.equal(idp.grants.length, 1)
  assert.equal(idp.grants[0].grant_type, "refresh_token")
  assert.equal(idp.grants[0].refresh_token, "refresh-1")
  assert.equal(idp.grants[0].resource, "https://backend.example.org")
  for (const credentials of results) assert.deepEqual(credentials, { accessToken: "access-2", idToken: "id-1" })

  const saved = JSON.parse(await readFile(first.file, "utf8"))
  assert.equal(saved.refreshToken, "refresh-2")
  assert.equal(saved.refreshing, false)
  if (posix) {
    assert.equal((await lstat(first.file)).mode & 0o777, 0o600)
    assert.equal((await lstat(path)).mode & 0o777, 0o700)
  }
})

void test("a token the admin refused is renewed even before it expires, unless another process already did", async (t) => {
  const idp = await fakeIdp(t)
  const auth = await store(await directory(t), session({ config: { ...session().config, issuer: idp.issuer } }))
  assert.equal((await auth.credentials("access-1")).accessToken, "access-2")
  assert.equal((await auth.credentials("access-1")).accessToken, "access-2")
  assert.equal(idp.grants.length, 1)
})

void test("a failed refresh is never replayed: the next request asks for login", async (t) => {
  const idp = await fakeIdp(t, { fail: true })
  const auth = await store(
    await directory(t),
    session({ expiresAt: 0, config: { ...session().config, issuer: idp.issuer } })
  )
  await assert.rejects(auth.credentials(), /could not be renewed/)
  await assert.rejects(auth.credentials(), /interrupted/)
  assert.equal(idp.grants.length, 1)
  assert.equal(JSON.parse(await readFile(auth.file, "utf8")).refreshing, true)
})

void test("the lock waits briefly for another process, then gives up; a dead holder's lock is taken over", async (t) => {
  const path = await directory(t)
  const auth = new AdminMcpAuth(ADMIN, path)
  const unlock = await auth.lock()
  const started = Date.now()
  await assert.rejects(new AdminMcpAuth(ADMIN, path).lock(300), /Another polinetwork-admin-mcp process/)
  assert.ok(Date.now() - started >= 300)

  const waiting = new AdminMcpAuth(ADMIN, path).lock(5000)
  setTimeout(() => void unlock(), 100)
  await (
    await waiting
  )()

  // A lock left by a process that has exited.
  const { stdout } = await promisify(execFile)(process.execPath, ["-p", "process.pid"])
  await mkdir(`${auth.file}.lock`)
  await writeFile(join(`${auth.file}.lock`, "owner"), stdout.trim())
  const begun = Date.now()
  await (
    await auth.lock(5000)
  )()
  assert.ok(Date.now() - begun < 1000)
})

void test("separate processes refresh once between them", async (t) => {
  const idp = await fakeIdp(t)
  const path = await directory(t)
  await store(path, session({ expiresAt: 0, config: { ...session().config, issuer: idp.issuer } }))
  const script = `
    const { AdminMcpAuth } = await import(${JSON.stringify(new URL("../src/mcp/client/auth.ts", import.meta.url).href)})
    const credentials = await new AdminMcpAuth(${JSON.stringify(ADMIN)}, ${JSON.stringify(path)}).credentials()
    process.stdout.write(credentials.accessToken)
  `
  const run = () =>
    promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script])
  const outputs = await Promise.all([run(), run(), run()])
  assert.deepEqual(
    outputs.map((output) => output.stdout),
    ["access-2", "access-2", "access-2"]
  )
  assert.equal(idp.grants.length, 1)
})
