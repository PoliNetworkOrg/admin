import { MCP_CALLBACK, MCP_DOWNLOAD_PATH, mcpConfigSchema } from "@/mcp/protocol"
import { resolveAppOrigin, SCOPES } from "@/server/auth-config"

/** The public native client an IdP administrator registers for the admin MCP: nothing secret. */
export function mcpPublicConfig(env: Record<string, string | undefined>, nodeEnv = env.NODE_ENV) {
  const origin = resolveAppOrigin(env, nodeEnv)
  const config = mcpConfigSchema.parse({
    clientId: env.ADMIN_MCP_CLIENT_ID,
    issuer: new URL("/api/auth", env.IDP_URL || "https://auth.polinetwork.org").href,
    resource: env.BACKEND_RESOURCE || "https://backend.internal.polinetwork.org",
    // The dashboard's own scopes: the MCP reaches the same backend procedures.
    scope: SCOPES,
  })
  return { ...config, redirectUri: MCP_CALLBACK, download: `${origin}${MCP_DOWNLOAD_PATH}` }
}
