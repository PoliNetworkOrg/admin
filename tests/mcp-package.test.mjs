import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import { z } from "zod"

void test(
  "the public download installs without dependencies and starts a real stdio MCP outside the repository",
  { timeout: 30_000 },
  async (t) => {
    const root = new URL("../", import.meta.url).pathname
    execFileSync(process.execPath, ["scripts/build-mcp.mjs"], { cwd: root, stdio: "pipe" })
    const archive = join(root, "public/downloads/polinetwork-admin-mcp.tgz")
    const checksum = await readFile(`${archive}.sha256`, "utf8")
    assert.equal(
      checksum.split(" ")[0],
      createHash("sha256")
        .update(await readFile(archive))
        .digest("hex")
    )
    const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n").sort()
    assert.deepEqual(entries, [
      "package/README.md",
      "package/cli.mjs",
      "package/cli.mjs.LEGAL.txt",
      "package/package.json",
    ])
    const directory = await mkdtemp(join(tmpdir(), "admin-mcp-package-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    execFileSync("tar", ["-xzf", archive, "-C", directory])
    const manifest = JSON.parse(await readFile(join(directory, "package/package.json"), "utf8"))
    assert.equal(manifest.dependencies, undefined)
    assert.deepEqual(manifest.bin, { "polinetwork-admin-mcp": "cli.mjs" })
    const help = execFileSync(process.execPath, [join(directory, "package/cli.mjs"), "help"], {
      encoding: "utf8",
      stdio: "pipe",
    })
    assert.equal(help, "", "stdout is reserved for MCP protocol messages")
    const client = new Client({ name: "package-smoke", version: "1" })
    t.after(() => client.close())
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(directory, "package/cli.mjs"), "serve"],
        cwd: directory,
        stderr: "pipe",
      })
    )
    assert.equal(client.getServerVersion().name, "polinetwork-admin")
    assert.ok(client.getServerCapabilities().tools)
    // Real upload envelopes can exceed the SDK's 10 MB default. Unknown methods exercise transport limits
    // without reading credentials or calling the API on the machine running the test.
    await assert.rejects(
      client.request(
        { method: "test/large-upload-envelope", params: { padding: "x".repeat(11 * 1024 * 1024) } },
        z.object({})
      ),
      /method not found/i
    )
    await client.ping()
  }
)
