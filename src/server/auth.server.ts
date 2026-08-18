import { AUTH_PATH } from "@polinetwork/backend"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { createAuthClient } from "better-auth/client"
import { env } from "@/env"
import type { AdminSession } from "@/lib/auth"
import { createAuthPlugins } from "@/lib/auth-plugins"
import { ADMIN_ROLES, hasAdminRole, isAgentModeEnabled } from "@/server/authorization"
import { type BackendClient, createBackendClient } from "@/server/backend.server"

const serverAuth = createAuthClient({
  baseURL: env.BACKEND_URL,
  basePath: AUTH_PATH,
  plugins: createAuthPlugins(),
})

const agentSession = {
  session: {
    id: "agent-preview-session",
    token: "agent-preview-token",
    userId: "agent-preview-user",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  user: {
    id: "agent-preview-user",
    name: "Preview Agent",
    email: "agent@polinetwork.org",
    emailVerified: true,
    image: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    telegramId: 1,
    telegramUsername: "preview-agent",
  },
} satisfies AdminSession

export function isAgentMode() {
  return import.meta.env.DEV && isAgentModeEnabled(env.NODE_ENV, env.AGENT_MODE)
}

export function getAgentSession() {
  return agentSession
}

async function readSession(requestHeaders: Headers): Promise<AdminSession | null> {
  if (isAgentMode()) return agentSession

  const response = await serverAuth.getSession({ fetchOptions: { headers: requestHeaders } })
  if (response.error)
    throw new Error(response.error.message ?? "The authentication service rejected the session request.")
  return response.data
}

export function createRequestBackend() {
  return createBackendClient(getRequestHeaders())
}

export function readRequestSession() {
  return readSession(getRequestHeaders())
}

export type AdminAuthorization = {
  session: AdminSession
  telegramId: number
  roles: string[]
}

export async function authorizeAdmin(
  session: AdminSession,
  backend: BackendClient
): Promise<AdminAuthorization | "telegram-unlinked" | "forbidden"> {
  const telegramId = session.user.telegramId
  if (!telegramId) return "telegram-unlinked"

  const roles = isAgentMode()
    ? [...ADMIN_ROLES]
    : ((await backend.tg.permissions.getRoles.query({ userId: telegramId })).roles ?? [])

  if (!hasAdminRole(roles)) return "forbidden"
  return { session, telegramId, roles }
}
