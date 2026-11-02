import { MCP_CALLBACK, MCP_DOWNLOAD, mcpConfigSchema } from "../mcp/protocol"
import { resolveAppOrigin } from "./auth-config"

/** A separate public native OAuth client, provisioned by an IdP administrator. */
export function mcpPublicConfig(env: NodeJS.ProcessEnv, nodeEnv = env.NODE_ENV) {
  const origin = resolveAppOrigin(env, nodeEnv)
  const config = mcpConfigSchema.parse({
    clientId: env.ADMIN_MCP_CLIENT_ID,
    issuer: new URL("/api/auth", env.IDP_URL || "https://auth.polinetwork.org").href,
    resource: env.BACKEND_RESOURCE || "https://backend.internal.polinetwork.org",
  })
  return { ...config, download: `${origin}${MCP_DOWNLOAD}`, redirectUri: MCP_CALLBACK }
}
