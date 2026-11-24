// Builds the public `polinetwork-admin-mcp` package: a self-contained bundle of src/mcp/client, its README and the
// licences of what it bundles, packed reproducibly (fixed timestamps and order) into public/downloads.
import { createHash } from "node:crypto"
import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

import { build } from "esbuild"

import { MCP_DOWNLOAD_PATH, MCP_VERSION } from "../src/mcp/protocol.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const destination = join(root, "dist/admin-mcp")
const downloads = join(root, "public", dirname(MCP_DOWNLOAD_PATH))
const archive = join(root, "public", MCP_DOWNLOAD_PATH)
/** The package README is docs/mcp.md up to this heading: the rest is for the admin's maintainers. */
const MAINTAINERS_HEADING = "\n## Activate on a deployment"

await rm(destination, { recursive: true, force: true })
const result = await build({
  absWorkingDir: root,
  entryPoints: { cli: "src/mcp/client/cli.ts" },
  outdir: destination,
  outExtension: { ".js": ".mjs" },
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  splitting: true,
  minify: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: 'import { createRequire as __adminMcpRequire } from "node:module"; const require = __adminMcpRequire(import.meta.url);',
  },
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
})

// Only src/mcp/client, src/mcp/protocol.ts and npm packages: never the dashboard's server code or environment.
const sources = Object.keys(result.metafile.inputs)
const local = sources.filter((path) => !path.includes("node_modules/"))
const foreign = local.filter((path) => !path.startsWith("src/mcp/client/") && path !== "src/mcp/protocol.ts")
if (foreign.length > 0) throw new Error(`The MCP package must not bundle ${foreign.join(", ")}.`)

/** Each bundled npm package's licence, as its MIT/ISC/BSD terms require. */
async function notices() {
  const packages = new Map()
  for (const path of sources) {
    const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(path)
    if (match) packages.set(match[2], join(root, match[1]))
  }
  const sections = []
  for (const [name, directory] of [...packages].toSorted(([a], [b]) => a.localeCompare(b))) {
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
    const licence = (await readdir(directory)).find((file) => /^licen[cs]e(\.|$)/i.test(file))
    if (!licence) throw new Error(`${name} has no licence file to ship.`)
    const text = await readFile(join(directory, licence), "utf8")
    sections.push(`${name}@${manifest.version} (${manifest.license})\n\n${text.trim()}\n`)
  }
  return `polinetwork-admin-mcp bundles these packages.\n\n${sections.join(`\n${"-".repeat(80)}\n\n`)}`
}

const docs = await readFile(join(root, "docs/mcp.md"), "utf8")
const end = docs.indexOf(MAINTAINERS_HEADING)
if (end === -1) throw new Error(`docs/mcp.md must have a "${MAINTAINERS_HEADING.trim()}" section.`)
await writeFile(join(destination, "README.md"), `${docs.slice(0, end).trimEnd()}\n`)
await writeFile(join(destination, "THIRD_PARTY_NOTICES.txt"), await notices())
await writeFile(
  join(destination, "package.json"),
  `${JSON.stringify(
    {
      name: "@polinetwork/admin-mcp",
      version: MCP_VERSION,
      description: "PoliNetwork Admin for AI agents (MCP over stdio), with the signed-in user's dashboard permissions",
      type: "module",
      bin: { "polinetwork-admin-mcp": "cli.mjs" },
      engines: { node: ">=22" },
      license: "UNLICENSED",
      repository: { type: "git", url: "https://github.com/PoliNetworkOrg/admin.git" },
    },
    null,
    2
  )}\n`
)
await chmod(join(destination, "cli.mjs"), 0o755)

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))
  )
  return nested.flat().toSorted()
}

/** One ustar header: npm and tar read `package/…` entries; owner and time are fixed so the archive is reproducible. */
function header(name, size, mode) {
  const block = Buffer.alloc(512)
  const field = (value, offset, length) => block.write(value, offset, length, "ascii")
  const octal = (value, offset, length) => field(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length)
  if (Buffer.byteLength(name) > 100) throw new Error(`${name} is too long for a tar header.`)
  field(name, 0, 100)
  octal(mode, 100, 8)
  octal(0, 108, 8)
  octal(0, 116, 8)
  octal(size, 124, 12)
  // 1985-10-26T08:15:00Z, as npm pack uses.
  octal(499162500, 136, 12)
  field("        ", 148, 8)
  field("0", 156, 1)
  field("ustar\0", 257, 6)
  field("00", 263, 2)
  let checksum = 0
  for (const byte of block) checksum += byte
  field(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8)
  return block
}

const blocks = []
for (const path of await files(destination)) {
  const name = `package/${relative(destination, path).split(sep).join("/")}`
  const bytes = await readFile(path)
  const executable = ((await stat(path)).mode & 0o100) !== 0
  blocks.push(header(name, bytes.length, executable ? 0o755 : 0o644), bytes)
  blocks.push(Buffer.alloc((512 - (bytes.length % 512)) % 512))
}
blocks.push(Buffer.alloc(1024))
const packed = gzipSync(Buffer.concat(blocks), { level: 9 })
await mkdir(downloads, { recursive: true })
await writeFile(archive, packed)
const name = MCP_DOWNLOAD_PATH.split("/").at(-1)
await writeFile(`${archive}.sha256`, `${createHash("sha256").update(packed).digest("hex")}  ${name}\n`)
console.error(`Built ${relative(root, archive)} (${Math.round(packed.length / 1024)} KB).`)
