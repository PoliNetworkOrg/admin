import { z } from "zod"

/** Shared by the admin's MCP endpoint and the local `polinetwork-admin-mcp` bridge. */
export const MCP_NAME = "polinetwork-admin"
export const MCP_VERSION = "1.0.1"
export const MCP_PATH = "/api/mcp"
export const MCP_CONFIG_PATH = "/api/mcp/config"
export const MCP_DOWNLOAD_PATH = "/downloads/polinetwork-admin-mcp.tgz"
/** The bridge's loopback callback, registered on the public native client. */
export const MCP_CALLBACK = "http://127.0.0.1:47322/callback"
/** The bridge sends the ID token it signed in with, so the admin knows the caller's name and email. */
export const MCP_ID_TOKEN_HEADER = "x-polinetwork-id-token"
/** A 30 MB PDF as base64 with room for the JSON envelope. */
export const MCP_MAX_MESSAGE_BYTES = 48 * 1024 * 1024
/** The tool whose result tells the bridge to announce a new tool list. */
export const MCP_REFRESH_TOOL = "refresh_permissions"

/** Only public client metadata: never the dashboard's own client credentials. */
export const mcpConfigSchema = z.object({
  clientId: z.string().min(1),
  issuer: z.url(),
  resource: z.url(),
  scope: z.string().min(1),
})
export type McpConfig = z.infer<typeof mcpConfigSchema>

/** An admin origin: HTTPS, or HTTP on loopback for development; nothing but scheme, host and port. */
export function publicOrigin(value: string) {
  const url = new URL(value)
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Use HTTPS, or HTTP on localhost for development.")
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use an origin without credentials, a path, query or fragment.")
  }
  return url.origin
}
