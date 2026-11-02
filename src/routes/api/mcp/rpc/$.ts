import { TRPC_PATH } from "@polinetwork/backend"
import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env"
import { resolveAppOrigin } from "@/server/auth-config"
import { createUntypedBackendClient } from "@/server/backend.server"
import { mcpAccessSchema, mcpRpcFailure, proxyMcpRpc } from "@/server/mcp-proxy"

function handle(request: Request) {
  if (!process.env.ADMIN_MCP_CLIENT_ID) {
    return mcpRpcFailure(503, "Admin MCP is not configured.")
  }
  return proxyMcpRpc(request, {
    origin: resolveAppOrigin(process.env, process.env.NODE_ENV),
    backendUrl: env.BACKEND_URL,
    trpcPath: TRPC_PATH,
    access: async (token) => mcpAccessSchema.parse(await createUntypedBackendClient(token).query("me.access")),
    fetch,
  })
}

export const Route = createFileRoute("/api/mcp/rpc/$")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
})
