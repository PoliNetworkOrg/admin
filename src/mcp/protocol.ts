import { z } from "zod"

export const MCP_NAME = "polinetwork-admin"
export const MCP_VERSION = "0.1.0"
export const MCP_RPC_PATH = "/api/mcp/rpc"
export const MCP_CALLBACK = "http://127.0.0.1:47322/callback"
export const MCP_DOWNLOAD = "/downloads/polinetwork-admin-mcp.tgz"
/** Covers a 50 MB signed-receipt batch encoded as base64, with room for the JSON envelope. */
export const MCP_MAX_MESSAGE_BYTES = 72 * 1024 * 1024

/** Only public client metadata: never put the dashboard's client credentials here. */
export const mcpConfigSchema = z.object({
  clientId: z.string().min(1),
  issuer: z.url(),
  resource: z.url(),
})
export type McpConfig = z.infer<typeof mcpConfigSchema>

export const signerProfileSchema = z.object({ name: z.string(), email: z.email().nullable() })
export type SignerProfile = z.infer<typeof signerProfileSchema>

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
