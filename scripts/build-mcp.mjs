import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises"

import { build } from "esbuild"

const destination = new URL("../dist/admin-mcp/", import.meta.url)
await mkdir(destination, { recursive: true })
await build({
  entryPoints: ["src/mcp/cli.ts"],
  outfile: new URL("cli.mjs", destination).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: 'import { createRequire as __mcpCreateRequire } from "node:module"; const require = __mcpCreateRequire(import.meta.url);',
  },
  legalComments: "linked",
  logLevel: "warning",
})
await chmod(new URL("cli.mjs", destination), 0o755)
await writeFile(
  new URL("package.json", destination),
  `${JSON.stringify(
    {
      name: "@polinetwork/admin-mcp",
      version: "0.1.0",
      description: "PoliNetwork Admin tools with the signed-in user's dashboard permissions",
      type: "module",
      bin: { "polinetwork-admin-mcp": "cli.mjs" },
      engines: { node: ">=22" },
      files: ["cli.mjs", "cli.mjs.LEGAL.txt", "README.md"],
      license: "UNLICENSED",
      repository: { type: "git", url: "https://github.com/PoliNetworkOrg/admin.git" },
    },
    null,
    2
  )}\n`
)
await copyFile("docs/mcp.md", new URL("README.md", destination))
const downloads = new URL("../public/downloads/", import.meta.url)
await mkdir(downloads, { recursive: true })
// npm pack only packages this generated directory, never the workspace or its .env files.
const packages = JSON.parse(
  execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", downloads.pathname], {
    cwd: destination,
    encoding: "utf8",
  })
)
// npm 11+ keys its JSON result by package name; earlier versions return an array.
const packed = Object.values(packages)[0]
if (!packed?.filename) throw new Error("npm pack did not return an archive filename.")
const archive = new URL("polinetwork-admin-mcp.tgz", downloads)
await copyFile(new URL(packed.filename, downloads), archive)
const bytes = await readFile(archive)
await writeFile(
  new URL("polinetwork-admin-mcp.tgz.sha256", downloads),
  `${createHash("sha256").update(bytes).digest("hex")}  polinetwork-admin-mcp.tgz\n`
)
console.error(`Built public admin MCP download (${Math.round(bytes.length / 1024)} KB).`)
