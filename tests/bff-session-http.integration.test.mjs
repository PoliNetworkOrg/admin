import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import test from "node:test"

import { redisSessionStore, closeSessionStore } from "../src/server/session-store.server.ts"

/** A compiled local BFF with real disposable Redis, a refused local IdP and a fake backend returning admin:access. */
void test(
  "compiled BFF survives IdP outage only with a valid access token",
  { skip: !process.env.TEST_ADMIN_SESSION_HTTP_URL || !process.env.TEST_REDIS_URL },
  async () => {
    const base = new URL(process.env.TEST_ADMIN_SESSION_HTTP_URL)
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
    const store = redisSessionStore(process.env.TEST_REDIS_URL)
    try {
      for (const [remaining, expected] of [
        [45000, 200],
        [-1000, 503],
      ]) {
        const opaque = randomUUID()
        const key = createHash("sha256").update(opaque).digest("base64url")
        const now = Date.now()
        const record = {
          sub: "local-person",
          sid: null,
          name: "Local Test",
          email: "test@example.org",
          picture: null,
          accessToken: "local-test-access",
          accessTokenExpiresAt: now + remaining,
          refreshToken: "local-test-refresh",
          idToken: "local-test-id",
          createdAt: now,
          lastSeenAt: now,
        }
        await store.create(key, record, 60000)
        try {
          const response = await fetch(new URL("/dashboard", base), {
            redirect: "manual",
            headers: { cookie: `__Host-pn-admin-session=${opaque}` },
          })
          assert.equal(response.status, expected)
          await response.text()
        } finally {
          await store.destroy(key)
        }
      }
    } finally {
      await closeSessionStore()
    }
  }
)
