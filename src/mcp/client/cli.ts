#!/usr/bin/env node
import { fileURLToPath } from "node:url"

import { MCP_VERSION, publicOrigin } from "../protocol.ts"
import { DEFAULT_ADMIN_URL } from "./commands.ts"

const COMMANDS = ["serve", "login", "logout", "status", "help"]
/** Development only: lets `serve` reach a loopback agent-mode admin without signing in. */
const DEV_ANONYMOUS = "POLINETWORK_ADMIN_MCP_DEV_ANONYMOUS"

const HELP = `polinetwork-admin-mcp ${MCP_VERSION}: PoliNetwork Admin for AI agents, with your own dashboard permissions.

Get started: run \`polinetwork-admin-mcp login\`, then have your MCP client start \`polinetwork-admin-mcp serve\`.

Usage: polinetwork-admin-mcp [command] [--admin-url <origin>]

Commands:
  login    Sign in with PoliNetwork Auth in your browser (once per computer).
  serve    Run the MCP server on stdin/stdout (the default; what your MCP client starts).
  status   Show the account, the credential file and the exact command for your MCP client.
  logout   Revoke the session and remove the local credentials.
  help     Show this help.

Options:
  --admin-url <origin>  The admin dashboard (default ${DEFAULT_ADMIN_URL}; also POLINETWORK_ADMIN_URL).

Requires Node.js 22 or newer. Credentials stay in ~/.polinetwork/admin-mcp/.`

/** Human output goes to stderr: stdout belongs to JSON-RPC in `serve`, and stays clean in every command. */
function say(text: string) {
  process.stderr.write(`${text}\n`)
}

function parseArguments(args: string[]) {
  let command: string | null = null
  let adminUrl = process.env.POLINETWORK_ADMIN_URL || DEFAULT_ADMIN_URL
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--admin-url") {
      const value = args[++index]
      if (!value) throw new Error("Pass an origin after --admin-url.")
      adminUrl = value
    } else if (arg.startsWith("--admin-url=")) {
      adminUrl = arg.slice("--admin-url=".length)
    } else if (arg === "--help" || arg === "-h") {
      command = "help"
    } else if (arg === "--version" || arg === "-v") {
      command = "version"
    } else if (command === null && COMMANDS.includes(arg)) {
      command = arg
    } else {
      throw new Error(`Unknown argument: ${arg}. Run polinetwork-admin-mcp help.`)
    }
  }
  return { command: command ?? "serve", adminUrl }
}

function loopback(origin: string) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname)
}

/** The MCP client configuration with absolute paths: works on Windows, where the npm shim is a .cmd file. */
function clientCommand(origin: string) {
  const args = [fileURLToPath(import.meta.url), "serve"]
  if (origin !== DEFAULT_ADMIN_URL) args.push("--admin-url", origin)
  return { command: process.execPath, args }
}

async function serve(origin: string) {
  const [{ runBridge }, { AdminMcpAuth }] = await Promise.all([import("./bridge.ts"), import("./auth.ts")])
  const anonymous = process.env[DEV_ANONYMOUS] === "1"
  if (anonymous && !loopback(origin)) throw new Error(`${DEV_ANONYMOUS} only works with a loopback --admin-url.`)
  if (anonymous) say(`${DEV_ANONYMOUS}: sending no credentials to ${origin} (development only).`)
  const auth = new AdminMcpAuth(origin)
  process.stdout.on("error", (error) => {
    console.error(error)
    process.exit(0)
  })
  await runBridge({
    origin: auth.origin,
    credentials: (rejected) => (anonymous ? Promise.resolve(null) : auth.credentials(rejected)),
    input: process.stdin,
    output: process.stdout,
    userAgent: `polinetwork-admin-mcp/${MCP_VERSION} node/${process.versions.node}`,
  })
}

async function openBrowser(url: URL) {
  say(`Sign in to PoliNetwork Admin in your browser. If it does not open, visit:\n${url.href}\n`)
  const { spawn } = await import("node:child_process")
  const [executable, args] =
    process.platform === "darwin"
      ? ["open", [url.href]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url.href]]
        : ["xdg-open", [url.href]]
  const browser = spawn(executable, args, { detached: true, stdio: "ignore" })
  browser.on("error", (error) => console.error(error))
  browser.unref()
}

async function main() {
  const major = Number(process.versions.node.split(".")[0])
  if (major < 22) throw new Error(`Node.js 22 or newer is required (this is ${process.versions.node}).`)
  const { command, adminUrl } = parseArguments(process.argv.slice(2))
  if (command === "help") return say(HELP)
  if (command === "version") return say(MCP_VERSION)
  const origin = publicOrigin(adminUrl)
  if (command === "serve") return serve(origin)

  const { AdminMcpAuth, fetchMcpConfig } = await import("./auth.ts")
  const auth = new AdminMcpAuth(origin)
  if (command === "login") {
    const { name, email } = await auth.login(openBrowser)
    say(`Signed in to ${origin} as ${name}${email ? ` <${email}>` : ""}.`)
    say("Your agent can now use your dashboard permissions. Restart the MCP server in your client if it is running.")
    return
  }
  if (command === "logout") {
    const outcome = await auth.logout()
    if (outcome.status === "revoked") {
      say("Signed out: the session is no longer valid and the local credentials are removed.")
      return
    }
    const why =
      outcome.status === "refused"
        ? `PoliNetwork Auth refused to revoke the session (${outcome.reason})`
        : "PoliNetwork Auth could not be reached to revoke the session"
    say(
      `The local credentials are removed, but ${why}. No copy is left on this computer; the session stays valid at PoliNetwork Auth until it expires, at most 30 days after its last renewal.`
    )
    return
  }
  const status = await auth.status()
  const enabled = await fetchMcpConfig(origin).then(
    () => "MCP enabled",
    (error: Error) => {
      console.error(error)
      return error instanceof TypeError ? "unreachable" : error.message
    }
  )
  say(`Admin:        ${origin} (${enabled})`)
  say(`Credentials:  ${status.file}`)
  if (status.signedIn) {
    say(`Account:      ${status.name || status.sub}${status.email ? ` <${status.email}>` : ""}`)
    say(
      status.interrupted
        ? "Session:      a refresh was interrupted; run login again."
        : `Session:      access token valid until ${new Date(status.expiresAt).toISOString()}, renewed automatically.`
    )
  } else {
    say(`Account:      ${status.reason}`)
  }
  say(`\nMCP client configuration (stdio), with absolute paths:\n${JSON.stringify(clientCommand(origin), null, 2)}`)
}

main().catch((error: Error) => {
  console.error(error)
  process.exitCode = 1
})
