import assert from "node:assert/strict"
import test from "node:test"

import { resolveAuthConfig } from "../src/server/auth-config.ts"
import { serializeCookie } from "../src/server/cookies.ts"
import { isTrustedRequest } from "../src/server/csrf.ts"
import { completeLogin, sealLoginState, openLoginState, safeReturnTo } from "../src/server/oidc-login.ts"
import {
  ensureFreshSession,
  SessionEndedError,
  AuthUnavailableError,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  isSessionExpired,
  sessionTtlMs,
} from "../src/server/session.ts"
const secret = "a-test-secret-with-more-than-32-characters"
const record = () => ({
  sub: "person",
  name: "Person",
  email: "p@example.org",
  picture: null,
  sid: null,
  createdAt: 0,
  lastSeenAt: 0,
  accessToken: "old",
  accessTokenExpiresAt: 20000,
  refreshToken: "refresh-old",
  idToken: "id",
})
function memoryStore(initial = record()) {
  let value = initial
  let lock = null
  return {
    read: async () => value,
    create: async (_key, next) => {
      value = next
    },
    destroy: async () => {
      value = null
      lock = null
    },
    touch: async () => value !== null,
    acquireLock: async (_key, owner) => {
      if (lock) return false
      lock = owner
      return true
    },
    releaseLock: async (_key, owner) => {
      if (lock === owner) lock = null
    },
    beginRefresh: async (_key, owner) => {
      if (!value || lock !== owner || value.refreshing) return false
      value = { ...value, refreshing: true }
      return true
    },
    saveTokens: async (_key, tokens, owner) => {
      if (!value || lock !== owner) return false
      value = { ...value, ...tokens, refreshing: false }
      return true
    },
    expireLock: () => {
      lock = null
    },
  }
}
const successor = { accessToken: "new", accessTokenExpiresAt: 300000, refreshToken: "refresh-new", idToken: "id-new" }
void test("production requires HTTPS, Redis, credentials and independent session secret", () => {
  const source = {
    APP_URL: "https://admin.example",
    OIDC_CLIENT_ID: "dashboard",
    OIDC_CLIENT_SECRET: "test",
    SESSION_SECRET: secret,
    REDIS_URL: "redis://localhost:36479",
  }
  const config = resolveAuthConfig(source, "production")
  assert.equal(config.issuer, "https://auth.polinetwork.org/api/auth")
  assert.equal(config.sessionCookie, "__Host-pn-admin-session")
  assert.throws(() => resolveAuthConfig({ ...source, REDIS_URL: undefined }, "production"), /REDIS_URL/)
  assert.throws(() => resolveAuthConfig({ ...source, APP_URL: "http://admin.example" }, "production"), /HTTPS/)
  assert.match(
    serializeCookie(config.sessionCookie, "opaque", { path: "/", secure: true, maxAgeSeconds: 60 }),
    /HttpOnly; SameSite=Lax; Secure/
  )
})
void test("every mutation requires exact configured Origin", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(isTrustedRequest(method, null, "https://admin.example"), false)
    assert.equal(isTrustedRequest(method, "https://evil.example", "https://admin.example"), false)
    assert.equal(isTrustedRequest(method, "https://admin.example", "https://admin.example"), true)
  }
  assert.equal(isTrustedRequest("GET", null, "https://admin.example"), true)
})
void test("encrypted login cookie rejects tampering, expiry and wrong secret", async () => {
  const login = { state: "state", nonce: "nonce", codeVerifier: "verifier", returnTo: "/dashboard", expiresAt: 1000 }
  const sealed = await sealLoginState(login, secret)
  assert.deepEqual(await openLoginState(sealed, secret, 100), login)
  assert.equal(await openLoginState(sealed, secret, 1000), null)
  assert.equal(await openLoginState(sealed, secret + "x", 100), null)
  assert.equal(await openLoginState(sealed.slice(0, -4) + "abcd", secret, 100), null)
})
void test("callback never exchanges without matching state; return path cannot redirect externally", async () => {
  let exchanges = 0
  const exchange = async () => {
    exchanges++
    return { tokens: successor, user: { sub: "person" }, sid: null }
  }
  const loginState = { state: "good", nonce: "n", codeVerifier: "v", expiresAt: 1000, returnTo: "//evil.example" }
  const callbackUrl = new URL("https://admin.example/auth/callback?state=bad&code=code")
  assert.equal((await completeLogin({ callbackUrl, loginState, exchange })).reason, "state-mismatch")
  assert.equal(exchanges, 0)
  callbackUrl.searchParams.set("state", "good")
  assert.equal((await completeLogin({ callbackUrl, loginState, exchange })).returnTo, "/dashboard")
  for (const target of ["https://evil.example", "//evil.example", "/\\evil.example"])
    assert.equal(safeReturnTo(target), "/dashboard")
})
void test("absolute seven-day and idle one-day deadlines cannot be extended", () => {
  assert.equal(isSessionExpired(record(), SESSION_IDLE_MS), true)
  assert.equal(isSessionExpired({ createdAt: 0, lastSeenAt: SESSION_ABSOLUTE_MS - 1 }, SESSION_ABSOLUTE_MS), true)
  assert.equal(sessionTtlMs({ createdAt: 0 }, SESSION_ABSOLUTE_MS - 100, SESSION_ABSOLUTE_MS - 100), 100)
})
void test("parallel requests share exactly one rotated token", async () => {
  const store = memoryStore()
  let calls = 0
  const refresh = async () => {
    calls++
    await new Promise((resolve) => setImmediate(resolve))
    return { status: "refreshed", tokens: successor }
  }
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      ensureFreshSession(record(), {
        store,
        key: "session",
        refresh,
        lockOwner: String(i),
        now: () => 1000,
        sleep: () => new Promise((resolve) => setImmediate(resolve)),
      })
    )
  )
  assert.equal(calls, 1)
  assert.ok(results.every((result) => result.refreshToken === "refresh-new"))
})
void test("invalid_grant deletes session; store outage fails closed", async () => {
  const store = memoryStore()
  await assert.rejects(
    ensureFreshSession(record(), {
      store,
      key: "session",
      refresh: async () => ({ status: "rejected" }),
      now: () => 1000,
    }),
    SessionEndedError
  )
  assert.equal(await store.read(), null)
  await assert.rejects(
    ensureFreshSession(record(), {
      store: {
        ...store,
        acquireLock: async () => {
          throw new Error("redis down")
        },
      },
      key: "session",
      refresh: async () => ({ status: "refreshed", tokens: successor }),
      now: () => 1000,
    }),
    /redis down/
  )
})
void test("IdP failure serves unexpired access token and does not replay an ambiguous refresh", async () => {
  const store = memoryStore()
  let calls = 0
  const refresh = async () => {
    calls++
    throw new Error("idp down")
  }
  assert.equal(
    (await ensureFreshSession(record(), { store, key: "session", refresh, now: () => 1000 })).accessToken,
    "old"
  )
  assert.equal(
    (await ensureFreshSession(await store.read(), { store, key: "session", refresh, now: () => 2000 })).accessToken,
    "old"
  )
  assert.equal(calls, 1)
  await assert.rejects(
    ensureFreshSession(await store.read(), { store, key: "session", refresh, now: () => 21000 }),
    SessionEndedError
  )
})
void test("expired token and failed IdP return unavailable", async () => {
  const store = memoryStore()
  await assert.rejects(
    ensureFreshSession(record(), {
      store,
      key: "session",
      refresh: async () => {
        throw new Error("idp down")
      },
      now: () => 21000,
    }),
    AuthUnavailableError
  )
})
void test("crashed refresh holder cannot overwrite or resurrect a session after lock expiry", async () => {
  const store = memoryStore()
  let resume
  const first = ensureFreshSession(record(), {
    store,
    key: "session",
    now: () => 21000,
    lockOwner: "first",
    refresh: () =>
      new Promise((resolve) => {
        resume = resolve
      }),
  })
  while (!resume) await new Promise((resolve) => setImmediate(resolve))
  store.expireLock()
  let secondCalls = 0
  await assert.rejects(
    ensureFreshSession(record(), {
      store,
      key: "session",
      now: () => 21000,
      lockOwner: "second",
      refresh: async () => {
        secondCalls++
        return { status: "refreshed", tokens: successor }
      },
    }),
    /REFRESH_INTERRUPTED/
  )
  resume({ status: "refreshed", tokens: successor })
  await assert.rejects(first, SessionEndedError)
  assert.equal(secondCalls, 0)
  assert.equal(await store.read(), null)
})
void test("logout during an in-flight refresh stays deleted", async () => {
  const store = memoryStore()
  await assert.rejects(
    ensureFreshSession(record(), {
      store,
      key: "session",
      now: () => 1000,
      refresh: async () => {
        await store.destroy()
        return { status: "refreshed", tokens: successor }
      },
    }),
    SessionEndedError
  )
  assert.equal(await store.read(), null)
})

void test("malformed private key errors never expose secret JSON fragments", () => {
  const marker = "SECRET_PRIVATE_JWK_FRAGMENT"
  try {
    resolveAuthConfig(
      {
        APP_URL: "https://admin.example",
        OIDC_CLIENT_ID: "dashboard",
        OIDC_CLIENT_PRIVATE_JWK: marker,
        SESSION_SECRET: secret,
        REDIS_URL: "redis://localhost:36479",
      },
      "production"
    )
    assert.fail("must reject invalid private key")
  } catch (error) {
    assert.ok(!String(error).includes(marker))
    assert.ok(!String(error).includes("SECRET_PRIVATE"))
  }
})
