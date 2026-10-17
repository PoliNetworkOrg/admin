import { createClient } from "redis"
import { z } from "zod"

import type { SessionRecord, SessionStore, SessionTokens } from "@/server/session"

/**
 * Sessions in the dashboard's own Redis (RFC v3 §11.2: one replica in the `admin` namespace, `maxmemory-policy
 * volatile-ttl`). Every key has a TTL. A session is a hash under `admin:session:<sha256(id)>`, so the cookie value
 * itself is never stored; its refresh lock is `admin:session-lock:<same>`. Fields are written individually, so a
 * `lastSeenAt` update can never overwrite tokens refreshed by a concurrent request.
 */

const SESSION_PREFIX = "admin:session:"
const LOCK_PREFIX = "admin:session-lock:"
/** Fails a request instead of queueing it while Redis is down: the dashboard answers 503 (fails closed). */
const COMMAND_TIMEOUT_MS = 2000

const TOUCH = `if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('HSET', KEYS[1], 'lastSeenAt', ARGV[1])
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0`

const BEGIN_REFRESH = `if redis.call('EXISTS', KEYS[1]) == 1 and redis.call('GET', KEYS[2]) == ARGV[1] and redis.call('HGET', KEYS[1], 'refreshing') ~= '1' then
  redis.call('HSET', KEYS[1], 'refreshing', '1')
  return 1
end
return 0`

const SAVE_TOKENS = `if redis.call('EXISTS', KEYS[1]) == 1 and redis.call('GET', KEYS[2]) == ARGV[5] then
  redis.call('HSET', KEYS[1], 'accessToken', ARGV[1], 'accessTokenExpiresAt', ARGV[2], 'refreshToken', ARGV[3], 'idToken', ARGV[4])
  redis.call('HDEL', KEYS[1], 'refreshing')
  return 1
end
return 0`

const RELEASE_LOCK = `if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`

const storedSession = z.object({
  refreshing: z.string().optional(),
  sub: z.string().min(1),
  sid: z.string(),
  name: z.string(),
  email: z.string(),
  picture: z.string(),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.coerce.number(),
  refreshToken: z.string().min(1),
  idToken: z.string().min(1),
  createdAt: z.coerce.number(),
  lastSeenAt: z.coerce.number(),
})

function connect(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    commandOptions: { timeout: COMMAND_TIMEOUT_MS },
    socket: {
      connectTimeout: COMMAND_TIMEOUT_MS,
      reconnectStrategy: (retries) =>
        retries >= 2 ? new Error("Redis unavailable") : Math.min(100 * 2 ** retries, 5000),
    },
  })
    .on("error", (error) => console.error(error))
    .connect()
}

type RedisClient = Awaited<ReturnType<typeof connect>>

let connection: Promise<RedisClient> | null = null

function redis(url: string) {
  connection ??= connect(url).catch((error) => {
    console.error(error)
    connection = null
    throw error
  })
  return connection
}

function toFields(record: SessionRecord) {
  return {
    sub: record.sub,
    name: record.name,
    email: record.email,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    idToken: record.idToken,
    sid: record.sid ?? "",
    picture: record.picture ?? "",
    accessTokenExpiresAt: String(record.accessTokenExpiresAt),
    createdAt: String(record.createdAt),
    lastSeenAt: String(record.lastSeenAt),
  }
}

function tokenArguments(tokens: SessionTokens) {
  return [tokens.accessToken, String(tokens.accessTokenExpiresAt), tokens.refreshToken, tokens.idToken]
}

export function redisSessionStore(url: string): SessionStore {
  return {
    async read(key) {
      const fields = await (await redis(url)).hGetAll(SESSION_PREFIX + key)
      if (Object.keys(fields).length === 0) return null
      const parsed = storedSession.safeParse(fields)
      // A partial hash (e.g. written while the key was being deleted) is not a session.
      if (!parsed.success) return null
      return {
        ...parsed.data,
        refreshing: parsed.data.refreshing === "1",
        sid: parsed.data.sid || null,
        picture: parsed.data.picture || null,
      }
    },
    async create(key, record, ttlMs) {
      await (
        await redis(url)
      )
        .multi()
        .hSet(SESSION_PREFIX + key, toFields(record))
        .pExpire(SESSION_PREFIX + key, Math.ceil(ttlMs))
        .exec()
    },
    async touch(key, lastSeenAt, ttlMs) {
      const result = await (
        await redis(url)
      ).eval(TOUCH, {
        keys: [SESSION_PREFIX + key],
        arguments: [String(lastSeenAt), String(Math.ceil(ttlMs))],
      })
      return result === 1
    },
    async beginRefresh(key, owner) {
      return (
        (await (
          await redis(url)
        ).eval(BEGIN_REFRESH, { keys: [SESSION_PREFIX + key, LOCK_PREFIX + key], arguments: [owner] })) === 1
      )
    },
    async saveTokens(key, tokens, owner) {
      const result = await (
        await redis(url)
      ).eval(SAVE_TOKENS, {
        keys: [SESSION_PREFIX + key, LOCK_PREFIX + key],
        arguments: [...tokenArguments(tokens), owner],
      })
      return result === 1
    },
    async destroy(key) {
      await (await redis(url)).del([SESSION_PREFIX + key, LOCK_PREFIX + key])
    },
    async acquireLock(key, owner, ttlMs) {
      const result = await (
        await redis(url)
      ).set(LOCK_PREFIX + key, owner, {
        condition: "NX",
        expiration: { type: "PX", value: ttlMs },
      })
      return result === "OK"
    },
    async releaseLock(key, owner) {
      await (await redis(url)).eval(RELEASE_LOCK, { keys: [LOCK_PREFIX + key], arguments: [owner] })
    },
  }
}

/** Release the process connection during graceful shutdown or local integration teardown. */
export async function closeSessionStore() {
  if (connection) {
    const client = await connection
    connection = null
    client.destroy()
  }
}
