import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { gunzipSync } from "node:zlib"

import { AdminMcpAuth } from "../src/mcp/client/auth.ts"
import { MCP_ID_TOKEN_HEADER, MCP_REFRESH_TOOL, MCP_VERSION } from "../src/mcp/protocol.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const archive = join(root, "public/downloads/polinetwork-admin-mcp.tgz")
const run = promisify(execFile)

async function buildPackage() {
  await run(process.execPath, ["--experimental-strip-types", "scripts/build-mcp.mjs"], { cwd: root })
  return readFile(archive)
}

/** The archive's files, from its ustar headers. */
function untar(gzipped) {
  const tar = gunzipSync(gzipped)
  const entries = new Map()
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "")
    const size = Number.parseInt(header.subarray(124, 136).toString("ascii"), 8)
    const mode = Number.parseInt(header.subarray(100, 108).toString("ascii"), 8)
    entries.set(name, { mode, bytes: tar.subarray(offset + 512, offset + 512 + size) })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

void test("the download is reproducible, self-contained and holds only the bridge", { timeout: 60_000 }, async () => {
  const first = await buildPackage()
  const second = await buildPackage()
  assert.ok(first.equals(second), "two builds produce the same archive")
  const [checksum, name] = (await readFile(`${archive}.sha256`, "utf8")).trim().split(/\s+/)
  assert.equal(checksum, createHash("sha256").update(first).digest("hex"))
  assert.equal(name, "polinetwork-admin-mcp.tgz")

  const entries = untar(first)
  const names = [...entries.keys()]
  const fixed = names.filter((entry) => !entry.startsWith("package/chunks/"))
  assert.deepEqual(
    fixed.toSorted((a, b) => a.localeCompare(b)),
    ["package/cli.mjs", "package/package.json", "package/README.md", "package/THIRD_PARTY_NOTICES.txt"]
  )
  assert.ok(names.filter((entry) => entry.startsWith("package/chunks/")).every((entry) => entry.endsWith(".mjs")))
  assert.equal(entries.get("package/cli.mjs").mode, 0o755)

  const manifest = JSON.parse(entries.get("package/package.json").bytes.toString("utf8"))
  assert.equal(manifest.version, MCP_VERSION)
  assert.deepEqual(manifest.bin, { "polinetwork-admin-mcp": "cli.mjs" })
  assert.equal(manifest.dependencies, undefined)
  const notices = entries.get("package/THIRD_PARTY_NOTICES.txt").bytes.toString("utf8")
  for (const dependency of ["openid-client", "oauth4webapi", "jose", "zod"])
    assert.match(notices, new RegExp(dependency))
  const readme = entries.get("package/README.md").bytes.toString("utf8")
  assert.match(readme, /polinetwork-admin-mcp login/)
  assert.doesNotMatch(readme, /For developers|ADMIN_MCP_CLIENT_ID/)

  const code = names.filter((entry) => entry.endsWith(".mjs")).map((entry) => entries.get(entry).bytes.toString("utf8"))
  for (const secret of ["ADMIN_MCP_CLIENT_ID", "AGENT_MODE", "OIDC_CLIENT", "REDIS_URL", "BACKEND_URL"]) {
    assert.ok(!code.some((source) => source.includes(secret)), `the bundle mentions ${secret}`)
  }
})

/** The packaged CLI, extracted outside the repository, with its own empty home directory. */
async function extracted(t) {
  const directory = await mkdtemp(join(tmpdir(), "admin-mcp-package-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  for (const [name, { mode, bytes }] of untar(await readFile(archive))) {
    const path = join(directory, name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
    await chmod(path, mode)
  }
  const home = join(directory, "home")
  await mkdir(home)
  return { cli: join(directory, "package/cli.mjs"), home, cwd: directory }
}

void test(
  "the packaged CLI keeps stdout for JSON-RPC and serves through a fake admin",
  { timeout: 60_000 },
  async (t) => {
    if (!(await readFile(archive).catch((error) => console.error(error)))) await buildPackage()
    const { cli, home, cwd } = await extracted(t)
    const env = { ...process.env, HOME: home, USERPROFILE: home }

    const help = await run(process.execPath, [cli, "help"], { cwd, env })
    assert.equal(help.stdout, "")
    assert.match(help.stderr, /polinetwork-admin-mcp login/)

    const received = []
    const server = createServer(async (request, reply) => {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const message = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      received.push({ headers: request.headers, message })
      if (message.id === undefined) return reply.writeHead(202).end()
      const result =
        message.method === "initialize"
          ? { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: true } } }
          : { content: [{ type: "text", text: String(JSON.stringify(message).length) }], isError: false }
      reply.writeHead(200, { "content-type": "application/json" })
      reply.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    t.after(() => server.close())
    const origin = `http://127.0.0.1:${server.address().port}`

    // A signed-in user, as `login` leaves the store.
    const auth = new AdminMcpAuth(origin, join(home, ".polinetwork/admin-mcp"))
    await mkdir(dirname(auth.file), { recursive: true, mode: 0o700 })
    await writeFile(
      auth.file,
      JSON.stringify({
        origin,
        config: {
          clientId: "c",
          issuer: `${origin}/api/auth`,
          resource: "https://backend.example.org",
          scope: "openid",
        },
        sub: "user-1",
        name: "Ada",
        email: "ada@example.org",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        idToken: "id-1",
        expiresAt: Date.now() + 600_000,
        refreshing: false,
      }),
      { mode: 0o600 }
    )

    const child = spawn(process.execPath, [cli, "serve", "--admin-url", origin], { cwd, env })
    t.after(() => child.kill())
    const lines = []
    let buffer = ""
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8")
      const parts = buffer.split("\n")
      buffer = parts.pop()
      lines.push(...parts.map((line) => JSON.parse(line)))
    })
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`)
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })
    send({ jsonrpc: "2.0", method: "notifications/initialized" })
    const padding = "x".repeat(11 * 1024 * 1024)
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "run_write", arguments: { padding } } })
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: MCP_REFRESH_TOOL, arguments: {} } })
    child.stdin.end()
    const [code] = await once(child, "exit")
    assert.equal(code, 0)

    assert.deepEqual(
      lines.map((line) => String(line.id ?? line.method)).toSorted((a, b) => a.localeCompare(b)),
      ["1", "2", "3", "notifications/tools/list_changed"]
    )
    assert.ok(Number(lines.find((line) => line.id === 2).result.content[0].text) > padding.length)
    assert.equal(received.length, 4)
    for (const { headers } of received) {
      assert.equal(headers.authorization, "Bearer access-1")
      assert.equal(headers[MCP_ID_TOKEN_HEADER], "id-1")
      assert.match(headers["user-agent"], new RegExp(`^polinetwork-admin-mcp/${MCP_VERSION.replaceAll(".", "\\.")} `))
    }
  }
)
