import { createHash } from "node:crypto"

import { TRPCClientError } from "@trpc/client"
import { createRemoteJWKSet, customFetch, decodeJwt, jwtVerify } from "jose"
import { z } from "zod"

import type { DashboardAccess } from "@/lib/auth"
import { accessOf, agentSession, authConfig, isAgentMode, loadAccess } from "@/server/auth.server"
import { createBackendClient } from "@/server/backend.server"
import type { McpRequest } from "@/server/mcp-request.server"
import { idpFetch, idpKeys } from "@/server/oidc.server"

/**
 * Permissions are cached this long per access token, bounded by the token's expiry: every operation runs behind its
 * server function's middleware with them, and the backend checks every call again with its own. `refresh_permissions`
 * reloads them on demand.
 */
export const ACCESS_TTL_MS = 5 * 60_000
const MAX_CALLERS = 1000
/** ID tokens only name the caller (the backend verified the access token's subject), so an old one still serves. */
const ID_TOKEN_MAX_AGE_S = 30 * 24 * 60 * 60

/** Why a request has no caller, with its HTTP status. Messages are safe to show the agent. */
export class McpCallerError extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    message: string
  ) {
    super(message)
  }
}

export type McpCaller = McpRequest & {
  access: Extract<DashboardAccess, { status: "authorized" }>
  /** When `access` was read from the backend. */
  loadedAt: number
  expiresAt: number
}

const callers = new Map<string, McpCaller>()

function remember(key: string, caller: McpCaller) {
  callers.delete(key)
  callers.set(key, caller)
  // Maps iterate in insertion order: drop the least recently loaded callers.
  for (const oldest of callers.keys()) {
    if (callers.size <= MAX_CALLERS) break
    callers.delete(oldest)
  }
}

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("base64url")
}

const expirySchema = z.object({ exp: z.number() })

/** The token's own expiry: read after the backend has accepted it, so its claims are authentic. */
function tokenExpiry(token: string) {
  try {
    const exp = expirySchema.safeParse(decodeJwt(token)).data?.exp
    return exp === undefined ? null : exp * 1000
  } catch (error) {
    console.error(error)
    return null
  }
}

let keySet: ReturnType<typeof createRemoteJWKSet> | null = null

const profileClaims = z.object({ sub: z.string().min(1), name: z.string().optional(), email: z.string().optional() })

/** The caller's name and email from the bridge's ID token: the MCP client's own, for the backend-verified subject. */
async function verifiedProfile(idToken: string, sub: string) {
  const clientId = process.env.ADMIN_MCP_CLIENT_ID
  if (!clientId) throw new McpCallerError(503, "The admin MCP is not configured on this server.")
  const config = authConfig()
  const { issuer, jwksUri } = await idpKeys(config)
  const fetchFromIdp = idpFetch(config)
  keySet ??= createRemoteJWKSet(new URL(jwksUri), {
    [customFetch]: (url, options) =>
      fetchFromIdp(url, { ...options, headers: Object.fromEntries(new Headers(options.headers)), body: undefined }),
  })
  try {
    const { payload } = await jwtVerify(idToken, keySet, {
      issuer,
      audience: clientId,
      clockTolerance: ID_TOKEN_MAX_AGE_S,
    })
    const claims = profileClaims.parse(payload)
    if (claims.sub !== sub) throw new Error("The ID token names another account.")
    return { sub, name: claims.name || sub, email: claims.email ?? "", picture: null }
  } catch (error) {
    console.error(error)
    throw new McpCallerError(401, "Sign in again: run `polinetwork-admin-mcp login`.")
  }
}

function admitted(access: DashboardAccess): Extract<DashboardAccess, { status: "authorized" }> {
  if (access.status === "authorized") return access
  if (access.stale) throw new McpCallerError(503, "Permissions are temporarily unavailable. Try again shortly.")
  throw new McpCallerError(403, "This account has no access to the admin dashboard.")
}

/** Agent mode (development only): the preview administrator, with sample data and no token. */
async function agentCaller(): Promise<McpCaller> {
  const session = agentSession()
  const access = admitted(await loadAccess(session, createBackendClient(session.accessToken)))
  const now = Date.now()
  return { session: { ...session, key: `mcp:${session.key}` }, access, loadedAt: now, expiresAt: now + ACCESS_TTL_MS }
}

/**
 * The caller of an MCP request: its access token (checked by the backend's `me.access`), the account's dashboard
 * access, and its profile from the MCP client's ID token. `refresh` skips the cache.
 */
export async function resolveCaller(
  credentials: { accessToken: string | null; idToken: string | null },
  refresh = false
): Promise<McpCaller> {
  if (!credentials.accessToken && isAgentMode()) return agentCaller()
  if (!credentials.accessToken) throw new McpCallerError(401, "Sign in: run `polinetwork-admin-mcp login`.")
  const key = tokenKey(credentials.accessToken)
  const now = Date.now()
  const cached = callers.get(key)
  if (cached && !refresh && now < cached.expiresAt) return cached
  callers.delete(key)

  let me: { sub: string; telegramId: string | null; permissions: string[]; stale: boolean }
  try {
    me = await createBackendClient(credentials.accessToken).me.access.query()
  } catch (error) {
    console.error(error)
    if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
      throw new McpCallerError(401, "The session expired. Run `polinetwork-admin-mcp login` if it persists.")
    }
    throw new McpCallerError(503, "The backend is unavailable. Try again shortly.")
  }
  if (!credentials.idToken) throw new McpCallerError(401, "Sign in again: run `polinetwork-admin-mcp login`.")
  const user = await verifiedProfile(credentials.idToken, me.sub)
  const session = { user, accessToken: credentials.accessToken, key: `mcp:${key}` }
  const access = admitted(await accessOf(session, me))
  const expiry = tokenExpiry(credentials.accessToken)
  const caller = {
    session,
    access,
    loadedAt: now,
    expiresAt: Math.min(now + ACCESS_TTL_MS, expiry ?? Number.POSITIVE_INFINITY),
  }
  remember(key, caller)
  return caller
}
