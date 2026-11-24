/** The admin the bridge talks to without `--admin-url`. */
export const DEFAULT_ADMIN_URL = "https://admin.polinetwork.org"

/** What a user types to install the bridge and connect each MCP client to `origin`. */
export function setupCommands(origin: string) {
  const admin = origin === DEFAULT_ADMIN_URL ? "" : ` --admin-url ${origin}`
  const args = admin ? ["serve", "--admin-url", origin] : ["serve"]
  return {
    install: `npm install -g ./polinetwork-admin-mcp.tgz\npolinetwork-admin-mcp login${admin}`,
    claude: `claude mcp add --scope user polinetwork-admin -- polinetwork-admin-mcp serve${admin}`,
    codex: `codex mcp add polinetwork-admin -- polinetwork-admin-mcp serve${admin}`,
    antigravity: JSON.stringify(
      { mcpServers: { "polinetwork-admin": { command: "polinetwork-admin-mcp", args } } },
      null,
      2
    ),
  }
}
