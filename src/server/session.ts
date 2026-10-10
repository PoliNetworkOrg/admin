/**
 * The dashboard's server-side session (RFC v3 §11.2): tokens never reach the browser, which only holds an opaque id.
 * This module has no I/O of its own; `session-store.server.ts` stores sessions in Redis and `auth.server.ts` wires the
 * IdP in.
 */

/** Equal to the backend resource's refresh-token lifetime. */
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000
/** Access tokens last 5 minutes; one with less than this left is refreshed first. */
export const ACCESS_TOKEN_MIN_REMAINING_MS = 60 * 1000
/** `lastSeenAt` is written at most this often, so idle expiry is accurate to the minute. */
export const TOUCH_INTERVAL_MS = 60 * 1000
/** Longer than a token request may take; a crashed holder frees the lock after this. */
export const REFRESH_LOCK_MS = 15 * 1000
/** How long a request waits for another one's refresh before giving up. */
export const REFRESH_WAIT_MS = 10 * 1000
export const REFRESH_POLL_MS = 150

export type SessionTokens = {
  accessToken: string
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number
  refreshToken: string
  idToken: string
}

export type SessionUser = {
  sub: string
  name: string
  email: string
  picture: string | null
}

export type SessionRecord = SessionTokens &
  SessionUser & {
    /** The IdP session (`sid`), for the end-session `id_token_hint`. */
    sid: string | null
    /** A refresh started but no successor was durably saved. A crashed holder requires a new login. */
    refreshing?: boolean
    createdAt: number
    lastSeenAt: number
  }

/** Storage for sessions and their refresh locks. Every method fails (rejects) when the store is unreachable. */
export type SessionStore = {
  read: (key: string) => Promise<SessionRecord | null>
  create: (key: string, record: SessionRecord, ttlMs: number) => Promise<void>
  /** Updates `lastSeenAt` and the TTL of an existing session; false when it no longer exists. */
  touch: (key: string, lastSeenAt: number, ttlMs: number) => Promise<boolean>
  /** Replaces the tokens of an existing session; false when it no longer exists. */
  beginRefresh: (key: string, owner: string) => Promise<boolean>
  saveTokens: (key: string, tokens: SessionTokens, owner: string) => Promise<boolean>
  destroy: (key: string) => Promise<void>
  /** `SET NX PX`: true when `owner` now holds the lock. */
  acquireLock: (key: string, owner: string, ttlMs: number) => Promise<boolean>
  /** Releases the lock only if `owner` still holds it. */
  releaseLock: (key: string, owner: string) => Promise<void>
}

/** When the session ends: the earlier of the absolute and the idle deadline. */
export function sessionDeadline(record: Pick<SessionRecord, "createdAt" | "lastSeenAt">) {
  return Math.min(record.createdAt + SESSION_ABSOLUTE_MS, record.lastSeenAt + SESSION_IDLE_MS)
}

export function isSessionExpired(record: Pick<SessionRecord, "createdAt" | "lastSeenAt">, now: number) {
  return now >= sessionDeadline(record)
}

/** The store TTL for a session last seen at `lastSeenAt`, so Redis drops it by itself too. */
export function sessionTtlMs(record: Pick<SessionRecord, "createdAt">, lastSeenAt: number, now: number) {
  return Math.max(1, sessionDeadline({ createdAt: record.createdAt, lastSeenAt }) - now)
}

export function needsRefresh(record: Pick<SessionTokens, "accessTokenExpiresAt">, now: number) {
  return record.accessTokenExpiresAt - now < ACCESS_TOKEN_MIN_REMAINING_MS
}

/** Thrown when the session is gone or the IdP refused its refresh token: sign in again. */
export class SessionEndedError extends Error {
  constructor(message = "SESSION_ENDED") {
    super(message)
    this.name = "SessionEndedError"
  }
}

/** Thrown when the IdP or the store cannot be reached and there is no usable access token (503). */
export class AuthUnavailableError extends Error {
  constructor(message = "AUTH_UNAVAILABLE", options?: ErrorOptions) {
    super(message, options)
    this.name = "AuthUnavailableError"
  }
}

export type RefreshResult =
  | { status: "refreshed"; tokens: SessionTokens }
  /** `invalid_grant`: the refresh token was revoked, expired or already used. */
  | { status: "rejected" }

type FreshTokenOptions = {
  store: SessionStore
  key: string
  /** Performs the refresh-token grant. Throws when the IdP cannot be reached. */
  refresh: (record: SessionRecord) => Promise<RefreshResult>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  lockOwner?: string
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function usable(record: SessionRecord, now: number) {
  return record.accessTokenExpiresAt > now
}

/**
 * The session with an access token that has at least a minute left, refreshing it when needed. Refreshes are
 * single-flight per session across instances: the holder of the Redis lock refreshes, everyone else waits for the
 * stored result, so a refresh token is never sent twice concurrently (RFC v3 §7.4, §11.2).
 *
 * - `invalid_grant` destroys the session and throws `SessionEndedError`.
 * - An unreachable IdP keeps serving the current access token while it is still valid, then throws
 *   `AuthUnavailableError`.
 */
export async function ensureFreshSession(record: SessionRecord, options: FreshTokenOptions): Promise<SessionRecord> {
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? wait
  if (!needsRefresh(record, now())) return record

  const { store, key } = options
  const owner = options.lockOwner ?? crypto.randomUUID()
  const deadline = now() + REFRESH_WAIT_MS

  for (;;) {
    if (await store.acquireLock(key, owner, REFRESH_LOCK_MS)) {
      try {
        // Another instance may have refreshed between our read and the lock.
        const latest = await store.read(key)
        if (!latest) throw new SessionEndedError()
        if (isSessionExpired(latest, now())) {
          await store.destroy(key)
          throw new SessionEndedError()
        }
        if (!needsRefresh(latest, now())) return latest
        // A crashed process may have spent the old token. Never replay it after the lock expires.
        if (latest.refreshing && usable(latest, now())) return latest
        if (latest.refreshing || !(await store.beginRefresh(key, owner))) {
          await store.destroy(key)
          throw new SessionEndedError("REFRESH_INTERRUPTED")
        }

        let result: RefreshResult
        try {
          result = await options.refresh(latest)
        } catch (error) {
          console.error(error)
          // A transport failure may have spent the refresh token. Leave the marker to prevent unsafe replay.
          if (usable(latest, now())) return latest
          throw new AuthUnavailableError("IDP_UNAVAILABLE", { cause: error })
        }
        if (result.status === "rejected") {
          await store.destroy(key)
          throw new SessionEndedError("REFRESH_REJECTED")
        }
        // The old refresh token is spent now; a session deleted meanwhile (sign-out) stays deleted.
        if (!(await store.saveTokens(key, result.tokens, owner))) throw new SessionEndedError()
        return { ...latest, ...result.tokens }
      } finally {
        await store.releaseLock(key, owner)
      }
    }

    await sleep(REFRESH_POLL_MS)
    const latest = await store.read(key)
    if (!latest || isSessionExpired(latest, now())) throw new SessionEndedError()
    if (!needsRefresh(latest, now())) return latest
    if (now() >= deadline) {
      if (usable(latest, now())) return latest
      throw new AuthUnavailableError("REFRESH_TIMEOUT")
    }
  }
}
