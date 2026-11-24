import { AsyncLocalStorage } from "node:async_hooks"

import type { DashboardAccess } from "@/lib/auth"
import type { RequestSession } from "@/server/auth.server"

/**
 * The admin MCP's caller for one tool call: a session built from the request's bearer token (no cookie is read) and
 * the access the MCP resolved for it. Server functions run inside it unchanged, behind their usual middleware.
 */
export type McpRequest = { session: RequestSession; access: DashboardAccess }

const storage = new AsyncLocalStorage<McpRequest>()

export function runAsMcpRequest<T>(request: McpRequest, run: () => Promise<T>) {
  return storage.run(request, run)
}

export function currentMcpRequest() {
  return storage.getStore() ?? null
}
