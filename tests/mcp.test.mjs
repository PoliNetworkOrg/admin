import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { pathToFileURL } from "node:url"

import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { build } from "esbuild"
import { SuperJSON } from "superjson"

const directory = await mkdtemp(join(tmpdir(), "admin-mcp-test-"))
after(() => rm(directory, { recursive: true, force: true }))
const root = new URL("../", import.meta.url).pathname
const entry = join(directory, "api.mjs")
await build({
  stdin: {
    contents: [
      "mcp/server",
      "mcp/catalog",
      "mcp/protocol",
      "mcp/auth",
      "mcp/files",
      "server/mcp-proxy",
      "server/mcp-config",
    ]
      .map((file) => `export * from ${JSON.stringify(`${root}src/${file}.ts`)}`)
      .join("\n"),
    resolveDir: root,
    loader: "ts",
  },
  outfile: entry,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
})
const {
  createAdminMcpServer,
  createAdminApi,
  tools,
  backendPath,
  rpcMethod,
  proxyMcpRpc,
  uploadForm,
  multipartInput,
  AdminMcpAuth,
  mcpPublicConfig,
  MCP_CALLBACK,
} = await import(pathToFileURL(entry).href)

async function connection(t, permissions) {
  const state = { permissions, stale: false, calls: [], mutationError: null }
  const api = {
    query: async (path, input) => {
      if (path === "me.access") return { sub: "person", permissions: state.permissions, stale: state.stale }
      state.calls.push({ method: "query", path, input })
      return []
    },
    mutation: async (path, input) => {
      state.calls.push({ method: "mutation", path, input })
      if (state.mutationError) throw state.mutationError
      return { error: null }
    },
  }
  const server = createAdminMcpServer(api)
  const client = new Client({ name: "test", version: "1" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  t.after(() => client.close())
  return { client, state }
}

void test("MCP handshake and schemas cover the complete dashboard allowlist", async (t) => {
  const permissions = ["admin:access", ...new Set(tools.flatMap((tool) => tool.permissions))]
  const { client } = await connection(t, permissions)
  const listed = await client.listTools()
  assert.equal(listed.tools.length, tools.length + 1)
  assert.equal(new Set(listed.tools.map((tool) => tool.name)).size, listed.tools.length)
  for (const tool of listed.tools) assert.equal(tool.inputSchema.type, "object", tool.name)
  assert.ok(tools.length > 120)
  assert.equal(rpcMethod("azure.groups.addMember"), null)
  assert.equal(rpcMethod("azure.groups.removeMember"), null)
  assert.equal(rpcMethod("azure.members.delete"), null)
  const sourcePaths = execFileSync(
    "rg",
    ["-o", "--no-filename", "context\\.backend\\.[A-Za-z0-9_.]+\\.(query|mutate)", "src/features"],
    { cwd: root, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .map((value) => value.replace(/^context\.backend\./, "").replace(/\.(query|mutate)$/, ""))
  // The dashboard also syncs its signer display profile from the ID token. It is internal, not a model tool.
  for (const path of sourcePaths.filter((path) => path !== "esign.profile.sync"))
    assert.ok(
      tools.some((tool) => backendPath(tool) === path),
      `Missing dashboard operation: ${path}`
    )
})

void test("permissions filter the tools and revocation is enforced before a call", async (t) => {
  const { client, state } = await connection(t, ["admin:access", "azure:members:read"])
  assert.ok((await client.listTools()).tools.some((tool) => tool.name === "azure_members_getAll"))
  assert.ok(!(await client.listTools()).tools.some((tool) => tool.name === "azure_members_create"))
  state.permissions = ["admin:access"]
  const denied = await client.callTool({ name: "azure_members_getAll", arguments: {} })
  assert.equal(denied.isError, true)
  assert.equal(state.calls.length, 0)
  state.stale = true
  assert.equal((await client.callTool({ name: "tg_groups_getAll", arguments: {} })).isError, true)
  state.stale = false
  state.permissions = []
  await assert.rejects(client.listTools())
})

void test("people:self admits personal and backend-scoped team tools without general admin data", async (t) => {
  const { client } = await connection(t, ["people:self"])
  const names = (await client.listTools()).tools.map((tool) => tool.name)
  assert.ok(names.includes("people_me_get"))
  assert.ok(names.includes("people_teams_list"))
  assert.ok(names.includes("people_capo_get"))
  assert.ok(!names.includes("people_persons_list"))
  assert.ok(!names.includes("tg_groups_getAll"))
  assert.ok(!names.includes("azure_members_getAll"))
})

void test("writes validate confirmation and input, refuse actor overrides, and never repeat", async (t) => {
  const { client, state } = await connection(t, [
    "admin:access",
    "tg:groups:manage",
    "tg:grants:manage",
    "web:reports:manage",
  ])
  assert.equal(
    (await client.callTool({ name: "tg_groups_leaveChat", arguments: { input: { chatId: -100 } } })).isError,
    true
  )
  assert.equal(state.calls.length, 0)
  const forged = await client.callTool({
    name: "tg_grants_create",
    arguments: {
      confirmed: true,
      input: {
        userId: 123,
        since: "2026-10-01T00:00:00Z",
        until: "2026-11-01T00:00:00Z",
        grantedBy: 999,
        grantedBySub: "evil",
      },
    },
  })
  assert.equal(forged.isError, true)
  assert.equal(state.calls.length, 0)
  const granted = await client.callTool({
    name: "tg_grants_create",
    arguments: {
      confirmed: true,
      input: { userId: 123, since: "2026-10-01T00:00:00Z", until: "2026-11-01T00:00:00Z" },
    },
  })
  assert.ok(!granted.isError)
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].input.grantedBy, undefined)
  assert.equal(state.calls[0].input.grantedBySub, undefined)
  assert.ok(state.calls[0].input.since instanceof Date)
  assert.equal(state.calls[0].input.sendTgLog, true)
  assert.equal(
    (await client.callTool({ name: "web_reports_dismiss", arguments: { confirmed: true, input: { ids: [1, 2] } } }))
      .isError,
    true
  )
  assert.equal(state.calls.length, 1)
})

void test("People output is parsed with the dashboard contract", async (t) => {
  const { client } = await connection(t, ["people:self"])
  const invalid = await client.callTool({ name: "people_me_get", arguments: {} })
  assert.equal(invalid.isError, true)
})

void test("a failed mutation is sent once and never retried automatically", async (t) => {
  const { client, state } = await connection(t, ["admin:access", "wa:groups:manage"])
  state.mutationError = new Error("Connection lost after submitting the change")
  const failed = await client.callTool({ name: "wa_groups_delete", arguments: { confirmed: true, input: { id: 42 } } })
  assert.equal(failed.isError, true)
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].path, "wa.groups.delete")
})

void test("multipart accepts explicit file bytes and enforces the dashboard file limits", async () => {
  const file = {
    field: "file",
    name: "guide.pdf",
    type: "application/pdf",
    base64: Buffer.from("%PDF-1.7\n").toString("base64"),
  }
  const form = await uploadForm(
    "web.guides_matricole.addGuide",
    multipartInput.parse({ fields: { version: "2026", date: "2026-10-01T00:00:00Z" }, files: [file] })
  )
  assert.equal(await form.get("file").text(), "%PDF-1.7\n")
  const maximum = await uploadForm(
    "web.guides_matricole.addGuide",
    multipartInput.parse({
      fields: { version: "2026", date: "2026-10-01T00:00:00Z" },
      files: [{ ...file, base64: Buffer.alloc(2 * 1024 * 1024).toString("base64") }],
    })
  )
  assert.equal(maximum.get("file").size, 2 * 1024 * 1024)
  await assert.rejects(
    uploadForm(
      "esign.documents.upload",
      multipartInput.parse({ files: [{ ...file, name: "payload.exe", type: "application/octet-stream" }] })
    )
  )
  assert.throws(() => multipartInput.parse({ files: [{ ...file, path: "/etc/passwd" }] }))
  assert.throws(() => multipartInput.parse({ files: [{ ...file, name: "../guide.pdf" }] }))
  await assert.rejects(
    uploadForm(
      "people.census.importPreview",
      multipartInput.parse({
        fields: { campaignId: "C-2026" },
        files: [
          { ...file, name: "export.csv", type: "text/csv", base64: Buffer.from('"unfinished').toString("base64") },
        ],
      })
    )
  )
})

function services() {
  return {
    origin: "https://admin.example",
    backendUrl: "http://backend.internal",
    trpcPath: "/api/trpc",
    access: async () => ({ permissions: ["admin:access"], stale: false }),
    fetch: async () => {
      throw new Error("Unexpected backend call")
    },
  }
}

void test("gateway requires bearer authorization, ignores browser sessions and refuses unlisted RPCs", async () => {
  for (const path of [
    "azure.groups.addMember",
    "azure.groups.removeMember",
    "tg.groups.getAll,azure.groups.addMember",
    "tg.groups.getAll%2Cme.access",
  ]) {
    assert.equal((await proxyMcpRpc(new Request(`https://admin.example/api/mcp/rpc/${path}`), services())).status, 404)
  }
  assert.equal(
    (
      await proxyMcpRpc(
        new Request("https://admin.example/api/mcp/rpc/tg.groups.getAll", {
          headers: { cookie: "pn-admin-session=not-authority" },
        }),
        services()
      )
    ).status,
    401
  )
  assert.equal(
    (
      await proxyMcpRpc(
        new Request("https://admin.example/api/mcp/rpc/tg.groups.getAll?batch=1", {
          headers: { authorization: "Bearer token" },
        }),
        services()
      )
    ).status,
    400
  )
  assert.equal(
    (
      await proxyMcpRpc(
        new Request("https://admin.example/api/mcp/rpc/tg.groups.getAll", {
          method: "POST",
          headers: { authorization: "Bearer token" },
        }),
        services()
      )
    ).status,
    405
  )
  assert.equal(
    (
      await proxyMcpRpc(
        new Request("https://admin.example/api/mcp/rpc/tg.groups.getAll", {
          headers: { authorization: "Bearer token", origin: "https://evil.example" },
        }),
        services()
      )
    ).status,
    403
  )
  assert.equal(
    (
      await proxyMcpRpc(
        new Request("https://admin.example/api/mcp/rpc/azure.members.getAll", {
          headers: { authorization: "Bearer token" },
        }),
        services()
      )
    ).status,
    403
  )
})

void test("gateway forwards only the user bearer token, strips cookies/redirects, and fails closed on stale access", async () => {
  const calls = []
  const configuration = {
    ...services(),
    fetch: async (url, init) => {
      calls.push({ url, init })
      return new Response('{"result":{}}', { headers: { "set-cookie": "evil=1", "content-type": "application/json" } })
    },
  }
  const request = new Request("https://admin.example/api/mcp/rpc/tg.groups.getAll", {
    headers: { authorization: "Bearer user-token", cookie: "private=1", "x-forwarded-host": "evil.example" },
  })
  const response = await proxyMcpRpc(request, configuration)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("set-cookie"), null)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(calls[0].url, "http://backend.internal/api/trpc/tg.groups.getAll")
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer user-token")
  assert.equal(calls[0].init.headers.get("cookie"), null)
  assert.equal(calls[0].init.headers.get("x-forwarded-host"), null)
  assert.equal(calls[0].init.redirect, "manual")
  configuration.access = async () => ({ permissions: ["admin:access"], stale: true })
  assert.equal((await proxyMcpRpc(request, configuration)).status, 503)
  assert.equal(calls.length, 1)
  configuration.access = services().access
  configuration.fetch = async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } })
  assert.equal((await proxyMcpRpc(request, configuration)).status, 502)
})

async function http(t, handler) {
  const server = createServer(async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error(error)
      res.statusCode = 500
      res.end("{}")
    }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      })
  )
  return `http://127.0.0.1:${server.address().port}`
}

void test("real tRPC HTTP transport preserves dates and multipart without cookies or batch calls", async (t) => {
  const requests = []
  const origin = await http(t, async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    requests.push({ url: req.url, method: req.method, headers: req.headers, body })
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ result: { data: SuperJSON.serialize({ at: new Date("2026-10-01T00:00:00Z") }) } }))
  })
  const api = createAdminApi(origin, async () => "user-token")
  const date = await api.query("tg.groups.getAll")
  assert.ok(date.at instanceof Date)
  await api.mutation("tg.grants.create", { since: date.at })
  const form = new FormData()
  form.set("file", new File(["%PDF"], "file.pdf", { type: "application/pdf" }))
  await api.mutation("esign.documents.upload", form)
  assert.equal(requests.length, 3)
  assert.equal(requests[0].headers.authorization, "Bearer user-token")
  assert.equal(requests[0].headers.cookie, undefined)
  assert.ok(!requests[0].url.includes("batch="))
  assert.equal(SuperJSON.deserialize(JSON.parse(requests[1].body)).since.toISOString(), date.at.toISOString())
  assert.match(requests[2].headers["content-type"], /^multipart\/form-data;/)
  assert.match(requests[2].body, /filename="file.pdf"/)
})

void test("gateway authorization errors remain readable through the real tRPC transformer", async (t) => {
  const origin = await http(t, async (req, res) => {
    const response = await proxyMcpRpc(new Request(`https://admin.example${req.url}`, { headers: req.headers }), {
      ...services(),
      access: async () => ({ permissions: [], stale: false }),
    })
    res.writeHead(response.status, { "content-type": "application/json" })
    res.end(await response.text())
  })
  await assert.rejects(
    createAdminApi(origin, async () => "token").query("tg.groups.getAll"),
    /This account cannot use this operation/
  )
})

void test("public manifest contains no dashboard secret and is disabled until the native client exists", () => {
  assert.throws(() => mcpPublicConfig({ APP_URL: "https://admin.example" }, "production"))
  const config = mcpPublicConfig(
    { APP_URL: "https://admin.example", ADMIN_MCP_CLIENT_ID: "native-client", OIDC_CLIENT_SECRET: "private-secret" },
    "production"
  )
  assert.equal(config.clientId, "native-client")
  assert.equal(config.redirectUri, MCP_CALLBACK)
  assert.ok(!JSON.stringify(config).includes("private-secret"))
})

void test("native OAuth login verifies state/PKCE/nonce/signatures, rotates once, and revokes without leaking tokens", async (t) => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "idp", alg: "RS256", use: "sig" }
  const tokenCalls = []
  let authorization
  let issuer
  let invalidToken = ""
  const origin = await http(t, async (req, res) => {
    res.setHeader("content-type", "application/json")
    let body = ""
    for await (const chunk of req) body += chunk
    if (req.url === "/api/mcp/config") {
      res.end(JSON.stringify({ clientId: "native", issuer, resource: "https://backend.example" }))
    } else if (req.url.includes(".well-known")) {
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          revocation_endpoint: `${issuer}/revoke`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["none"],
          code_challenge_methods_supported: ["S256"],
        })
      )
    } else if (req.url.endsWith("/jwks")) {
      res.end(JSON.stringify({ keys: [jwk] }))
    } else {
      const parameters = new URLSearchParams(body)
      tokenCalls.push(parameters)
      assert.equal(req.headers.authorization, undefined)
      assert.equal(parameters.get("client_id"), "native")
      if (req.url.endsWith("/revoke")) {
        res.end("{}")
        return
      }
      assert.equal(parameters.get("resource"), "https://backend.example")
      if (parameters.get("grant_type") === "refresh_token") {
        assert.equal(parameters.get("refresh_token"), "refresh-one")
        res.end(
          JSON.stringify({
            access_token: "access-two",
            refresh_token: "refresh-two",
            token_type: "Bearer",
            expires_in: 300,
          })
        )
        return
      }
      assert.equal(
        createHash("sha256").update(parameters.get("code_verifier")).digest("base64url"),
        authorization.searchParams.get("code_challenge")
      )
      assert.equal(parameters.get("redirect_uri"), MCP_CALLBACK)
      const now = Math.floor(Date.now() / 1000)
      const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "idp" })).toString("base64url")
      const claims = Buffer.from(
        JSON.stringify({
          iss: invalidToken === "issuer" ? "https://evil.example" : issuer,
          aud: "native",
          sub: "person",
          iat: now,
          exp: now + 300,
          nonce: invalidToken === "nonce" ? "wrong" : authorization.searchParams.get("nonce"),
        })
      ).toString("base64url")
      const jwt = `${head}.${claims}.${sign("sha256", Buffer.from(`${head}.${claims}`), keys.privateKey).toString("base64url")}`
      res.end(
        JSON.stringify({
          access_token: "access-one",
          refresh_token: "refresh-one",
          token_type: "Bearer",
          expires_in: 10,
          id_token: invalidToken === "signature" ? `${jwt.slice(0, -8)}abcdefgh` : jwt,
        })
      )
    }
  })
  issuer = `${origin}/api/auth`
  const auth = new AdminMcpAuth(origin, join(directory, "credentials"))
  const callback = async (url) => {
    authorization = url
    assert.equal(url.searchParams.get("code_challenge_method"), "S256")
    assert.equal(url.searchParams.get("scope"), "openid profile email offline_access backend:admin")
    const bad = new URL(MCP_CALLBACK)
    bad.searchParams.set("state", "wrong")
    bad.searchParams.set("code", "code")
    assert.equal((await fetch(bad)).status, 400)
    const good = new URL(bad)
    good.searchParams.set("state", url.searchParams.get("state"))
    assert.equal((await fetch(good)).status, 200)
  }
  await auth.login(callback)
  assert.equal((await stat(auth.file)).mode & 0o777, 0o600)
  assert.equal((await stat(join(directory, "credentials"))).mode & 0o777, 0o700)
  assert.deepEqual(await Promise.all([auth.accessToken(), auth.accessToken()]), ["access-two", "access-two"])
  assert.equal(tokenCalls.filter((call) => call.get("grant_type") === "refresh_token").length, 1)
  assert.equal(JSON.parse(await readFile(auth.file, "utf8")).refreshToken, "refresh-two")
  const stored = JSON.parse(await readFile(auth.file, "utf8"))
  await writeFile(auth.file, JSON.stringify({ ...stored, refreshing: true }))
  await assert.rejects(auth.accessToken())
  assert.equal(tokenCalls.filter((call) => call.get("grant_type") === "refresh_token").length, 1)
  await writeFile(auth.file, JSON.stringify({ ...stored, refreshing: false }))
  await auth.logout()
  assert.equal(tokenCalls.at(-1).get("token"), "refresh-two")
  await assert.rejects(stat(auth.file), { code: "ENOENT" })
  for (const invalid of ["nonce", "issuer", "signature"]) {
    invalidToken = invalid
    await assert.rejects(auth.login(callback))
    await assert.rejects(stat(auth.file), { code: "ENOENT" })
  }
  invalidToken = ""
  await auth.login(callback)
  await chmod(auth.file, 0o644)
  await assert.rejects(auth.accessToken())
})
