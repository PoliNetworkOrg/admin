#!/usr/bin/env node
import { spawn } from "node:child_process"

import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"

import { AdminMcpAuth } from "./auth"
import { createAdminApi, createAdminMcpServer } from "./server"

const args = process.argv.slice(2)
const command = args.find((arg) => ["login", "logout", "serve", "help"].includes(arg)) ?? "serve"
const originIndex = args.indexOf("--admin-url")
const origin = originIndex === -1 ? "https://admin.polinetwork.org" : args[originIndex + 1]

async function main() {
  if (command === "help" || args.includes("--help")) {
    console.error(
      "PoliNetwork Admin MCP\n\n  polinetwork-admin-mcp login [--admin-url https://admin.polinetwork.org]\n  polinetwork-admin-mcp serve [--admin-url ...]\n  polinetwork-admin-mcp logout [--admin-url ...]\n\nLogin in your browser once, then configure your MCP client to run this command with serve. Tokens stay in your private ~/.polinetwork/admin-mcp directory. Requires Node.js 22 or newer."
    )
    return
  }
  if (!origin) throw new Error("Supply an origin after --admin-url.")
  const auth = new AdminMcpAuth(origin)
  if (command === "login") {
    await auth.login((url) => {
      console.error(`Sign in to PoliNetwork Admin:\n${url.href}`)
      const executable = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open"
      const browserArgs = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url.href] : [url.href]
      const browser = spawn(executable, browserArgs, { detached: true, stdio: "ignore" })
      browser.on("error", (error) => {
        console.error(new Error(error.name))
        console.error("Open the sign-in link above in your browser.")
      })
      browser.unref()
    })
    console.error("Connected. Your agent can now use your current dashboard permissions.")
    return
  }
  if (command === "logout") {
    await auth.logout()
    console.error("Disconnected. Local credentials removed and refresh token revoked.")
    return
  }
  const api = createAdminApi(
    auth.origin,
    () => auth.accessToken(),
    () => auth.signerProfile()
  )
  await createAdminMcpServer(api).connect(new StdioServerTransport())
}

main().catch((error) => {
  console.error(new Error(error instanceof Error ? error.message : "Admin MCP failed"))
  process.exitCode = 1
})
