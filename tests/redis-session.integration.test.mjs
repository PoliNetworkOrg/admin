import assert from "node:assert/strict"
import test from "node:test"

import { redisSessionStore, closeSessionStore } from "../src/server/session-store.server.ts"
import { ensureFreshSession } from "../src/server/session.ts"

void test(
  "Redis atomically locks, fences token writes and preserves logout under refresh",
  { skip: !process.env.TEST_REDIS_URL },
  async () => {
    const store = redisSessionStore(process.env.TEST_REDIS_URL)
    const key = crypto.randomUUID()
    const now = Date.now()
    const record = {
      sub: "test",
      sid: null,
      name: "Test",
      email: "test@example.org",
      picture: null,
      accessToken: "old",
      accessTokenExpiresAt: now + 1000,
      refreshToken: "old-refresh",
      idToken: "id",
      createdAt: now,
      lastSeenAt: now,
    }
    const tokens = {
      accessToken: "new",
      accessTokenExpiresAt: now + 300000,
      refreshToken: "new-refresh",
      idToken: "new-id",
    }
    try {
      await store.create(key, record, 60000)
      let calls = 0
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          ensureFreshSession(record, {
            store,
            key,
            lockOwner: String(i),
            refresh: async () => {
              calls++
              return { status: "refreshed", tokens }
            },
          })
        )
      )
      assert.equal(calls, 1)
      assert.ok(results.every((result) => result.refreshToken === "new-refresh"))
      assert.equal(await store.saveTokens(key, { ...tokens, refreshToken: "stale" }, "lost-owner"), false)
      assert.equal((await store.read(key)).refreshToken, "new-refresh")
      assert.equal(await store.acquireLock(key, "owner", 10000), true)
      await store.releaseLock(key, "other")
      assert.equal(await store.acquireLock(key, "other", 10000), false)
      await store.destroy(key)
      assert.equal(await store.saveTokens(key, tokens, "owner"), false)
      assert.equal(await store.touch(key, now + 1, 60000), false)
      assert.equal(await store.read(key), null)
    } finally {
      await store.destroy(key)
      await closeSessionStore()
    }
  }
)
