import { getCookie, setResponseStatus } from "@tanstack/react-start/server"

import { env } from "@/env"
import type { DashboardAccess } from "@/lib/auth"
import { type AuthConfig, CALLBACK_PATH, resolveAuthConfig } from "@/server/auth-config"
import type { BackendClient } from "@/server/backend.server"
import { expiredCookie, serializeCookie } from "@/server/cookies"
import { completeLogin, LOGIN_STATE_MAX_AGE_S, openLoginState, safeReturnTo, sealLoginState } from "@/server/oidc-login"
import {
  authorizationUrl,
  endSessionUrl,
  exchangeCode,
  newLoginChecks,
  refreshTokens,
  revokeRefreshToken,
} from "@/server/oidc.server"
import { hasPermission, isAgentModeEnabled, PERMISSIONS } from "@/server/permissions"
import {
  AuthUnavailableError,
  ensureFreshSession,
  isSessionExpired,
  SESSION_ABSOLUTE_MS,
  type SessionRecord,
  type SessionStore,
  SessionEndedError,
  type SessionUser,
  sessionTtlMs,
  TOUCH_INTERVAL_MS,
} from "@/server/session"
import { redisSessionStore } from "@/server/session-store.server"

/** `me.access` is cached this long per session (RFC v3 §11.3: "a few seconds"). */
const ACCESS_CACHE_MS = 5000
const ACCESS_CACHE_MAX_ENTRIES = 1000

export type RequestSession = {
  user: SessionUser
  /** `null` only in agent mode. */
  accessToken: string | null
  /** The store key; never the cookie value. */
  key: string
}

const agentSession: RequestSession = {
  user: { sub: "agent-preview-user", name: "Preview Agent", email: "agent@polinetwork.org", picture: null },
  accessToken: null,
  key: "agent-preview-session",
}

export function isAgentMode() {
  return import.meta.env.DEV && isAgentModeEnabled(env.NODE_ENV, env.AGENT_MODE)
}

let config: AuthConfig | null = null
let store: SessionStore | null = null

/** Validated on first use, so the build does not need the runtime secrets. */
export function authConfig() {
  config ??= resolveAuthConfig(process.env, process.env.NODE_ENV)
  return config
}

function sessionStore() {
  store ??= redisSessionStore(authConfig().redisUrl)
  return store
}

function randomId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
}

/** The store key of a session id: a leaked Redis dump does not contain usable cookies. */
async function sessionKey(id: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id))
  return Buffer.from(digest).toString("base64url")
}

function unavailable(error: Error) {
  console.error(error)
  setResponseStatus(503)
  return error instanceof AuthUnavailableError
    ? error
    : new AuthUnavailableError("SESSION_STORE_UNAVAILABLE", { cause: error })
}

function sessionCookieHeader(id: string) {
  const { sessionCookie, secureCookies } = authConfig()
  return serializeCookie(sessionCookie, id, {
    path: "/",
    maxAgeSeconds: SESSION_ABSOLUTE_MS / 1000,
    secure: secureCookies,
  })
}

function clearedSessionCookie() {
  const { sessionCookie, secureCookies } = authConfig()
  return expiredCookie(sessionCookie, { path: "/", secure: secureCookies })
}

async function readStoredSession(key: string, now: number) {
  try {
    const record = await sessionStore().read(key)
    if (!record || !isSessionExpired(record, now)) return record
    await sessionStore().destroy(key)
    return null
  } catch (error) {
    console.error(error)
    throw unavailable(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * The signed-in user and a fresh access token, or null when there is no live session. Absolute (7 d) and idle (24 h)
 * expiry are checked here as well as through the Redis TTL. Throws `AuthUnavailableError` (503) when Redis is down,
 * or when the IdP is down and the access token has expired: the dashboard fails closed.
 */
export async function readRequestSession(): Promise<RequestSession | null> {
  if (isAgentMode()) return agentSession
  const id = getCookie(authConfig().sessionCookie)
  if (!id) return null
  const key = await sessionKey(id)
  const now = Date.now()
  const stored = await readStoredSession(key, now)
  if (!stored) return null

  let record: SessionRecord
  try {
    record = await ensureFreshSession(stored, {
      store: sessionStore(),
      key,
      refresh: (current) => refreshTokens(authConfig(), current),
    })
  } catch (error) {
    console.error(error)
    if (error instanceof SessionEndedError) return null
    throw unavailable(error instanceof Error ? error : new Error(String(error)))
  }

  if (now - record.lastSeenAt >= TOUCH_INTERVAL_MS) {
    try {
      if (!(await sessionStore().touch(key, now, sessionTtlMs(record, now, now)))) return null
    } catch (error) {
      console.error(error)
      throw unavailable(error instanceof Error ? error : new Error(String(error)))
    }
  }
  const { sub, name, email, picture } = record
  return { user: { sub, name, email, picture }, accessToken: record.accessToken, key }
}

const accessCache = new Map<string, { loadedAt: number; access: DashboardAccess }>()

function cacheAccess(key: string, access: DashboardAccess, now: number) {
  accessCache.delete(key)
  accessCache.set(key, { loadedAt: now, access })
  // Maps iterate in insertion order: drop the least recently loaded entries.
  for (const oldest of accessCache.keys()) {
    if (accessCache.size <= ACCESS_CACHE_MAX_ENTRIES) break
    accessCache.delete(oldest)
  }
}

/**
 * The user's permissions from the backend's `me.access` (RFC v3 §11.3). They decide what the UI offers; the backend
 * enforces every call regardless. A stale snapshot reports no permissions, so the dashboard denies access until it
 * recovers.
 */
export async function loadAccess(session: RequestSession, backend: BackendClient): Promise<DashboardAccess> {
  if (isAgentMode()) {
    return { status: "authorized", user: { ...session.user, telegramId: "1" }, permissions: [...PERMISSIONS] }
  }
  const now = Date.now()
  const cached = accessCache.get(session.key)
  if (cached && now - cached.loadedAt < ACCESS_CACHE_MS) return cached.access

  const result = await backend.me.access.query()
  const user = { ...session.user, telegramId: result.telegramId }
  const access: DashboardAccess = hasPermission(result.permissions, "admin:access")
    ? { status: "authorized", user, permissions: result.permissions }
    : { status: "forbidden", user, stale: result.stale }
  cacheAccess(session.key, access, now)
  return access
}

function redirectResponse(location: string, cookies: string[], status = 303) {
  const headers = new Headers({ location, "cache-control": "no-store" })
  for (const cookie of cookies) headers.append("set-cookie", cookie)
  return new Response(null, { status, headers })
}

function serviceUnavailable(cookies: string[] = []) {
  const headers = new Headers({ "cache-control": "no-store" })
  for (const cookie of cookies) headers.append("set-cookie", cookie)
  return new Response("The sign-in service is temporarily unavailable. Try again shortly.", { status: 503, headers })
}

/** `GET /auth/login`: a fresh PKCE verifier, `state` and `nonce`, then 302 to the IdP's authorization endpoint. */
export async function startLogin(request: Request) {
  const current = authConfig()
  const checks = newLoginChecks()
  let location: URL
  try {
    location = await authorizationUrl(current, checks)
  } catch (error) {
    console.error(error)
    return serviceUnavailable()
  }
  const sealed = await sealLoginState(
    {
      ...checks,
      returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")),
      expiresAt: Date.now() + LOGIN_STATE_MAX_AGE_S * 1000,
    },
    current.sessionSecret
  )
  const loginCookie = serializeCookie(current.loginCookie, sealed, {
    path: CALLBACK_PATH,
    maxAgeSeconds: LOGIN_STATE_MAX_AGE_S,
    secure: current.secureCookies,
  })
  return redirectResponse(location.href, [loginCookie], 302)
}

/**
 * `GET /auth/callback`: checks `state` against the cookie, exchanges the code and validates the ID token, then starts
 * a new server-side session (a new id every time, so a planted cookie can't be fixated).
 */
export async function finishLogin(request: Request) {
  const current = authConfig()
  const clearLogin = expiredCookie(current.loginCookie, { path: CALLBACK_PATH, secure: current.secureCookies })
  // Built from the configured origin: behind the proxy the request URL may not carry the public scheme and host.
  const callbackUrl = new URL(`${CALLBACK_PATH}${new URL(request.url).search}`, current.appOrigin)
  const loginState = await openLoginState(getCookie(current.loginCookie), current.sessionSecret, Date.now())
  const result = await completeLogin({
    callbackUrl,
    loginState,
    exchange: (url, checks) => exchangeCode(current, url, checks),
  })
  if (result.status === "failed") {
    return redirectResponse(`/login?error=${result.reason}`, [clearLogin])
  }

  const now = Date.now()
  const record: SessionRecord = {
    ...result.login.tokens,
    ...result.login.user,
    sid: result.login.sid,
    createdAt: now,
    lastSeenAt: now,
  }
  const id = randomId()
  try {
    const previous = getCookie(current.sessionCookie)
    if (previous) await sessionStore().destroy(await sessionKey(previous))
    await sessionStore().create(await sessionKey(id), record, sessionTtlMs(record, now, now))
  } catch (error) {
    console.error(error)
    return serviceUnavailable([clearLogin])
  }
  return redirectResponse(result.returnTo, [clearLogin, sessionCookieHeader(id)])
}

/**
 * `POST /auth/logout` (Origin-checked like every POST): deletes the session, revokes its refresh token, then sends
 * the browser to the IdP's end-session endpoint to close the IdP session too.
 */
export async function logout() {
  const current = authConfig()
  const id = getCookie(current.sessionCookie)
  let location = "/login"
  if (id) {
    const key = await sessionKey(id)
    let record: SessionRecord | null
    try {
      record = await sessionStore().read(key)
      await sessionStore().destroy(key)
    } catch (error) {
      console.error(error)
      return serviceUnavailable([clearedSessionCookie()])
    }
    accessCache.delete(key)
    if (record) {
      try {
        await revokeRefreshToken(current, record.refreshToken)
      } catch (error) {
        // The session is already gone here; an unrevoked refresh token still expires with its family.
        console.error(error)
      }
      try {
        location = (await endSessionUrl(current, record.idToken)).href
      } catch (error) {
        console.error(error)
      }
    }
  }
  return redirectResponse(location, [clearedSessionCookie()])
}
