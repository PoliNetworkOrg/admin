import { z } from "zod"

import { resolveAppOrigin } from "@/server/auth-config"
import { isAgentMode } from "@/server/auth.server"

import { McpCallerError } from "./caller.server"
import { MCP_ID_TOKEN_HEADER, MCP_MAX_MESSAGE_BYTES } from "./protocol"
import { handleMcpMessages, type McpResponseBody } from "./server.server"

const NO_STORE = { "cache-control": "no-store" }

function json(status: number, body: McpResponseBody | null, extra: Record<string, string> = {}) {
  const headers = new Headers({ ...NO_STORE, ...extra })
  if (body === null) return new Response(null, { status, headers })
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), { status, headers })
}

function rpcError(status: number, message: string, headers: Record<string, string> = {}) {
  return json(status, { jsonrpc: "2.0", id: null, error: { code: -32000 - status, message } }, headers)
}

/** At most MCP_MAX_MESSAGE_BYTES within 60 seconds; null when larger or slower. */
async function readLimited(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MCP_MAX_MESSAGE_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  let timedOut = false
  const deadline = setTimeout(() => {
    timedOut = true
    void reader.cancel()
  }, 60_000)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MCP_MAX_MESSAGE_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return timedOut ? null : Buffer.concat(chunks).toString("utf8")
  } finally {
    clearTimeout(deadline)
  }
}

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/

/**
 * `POST /api/mcp`: the admin MCP over Streamable HTTP, called by the `polinetwork-admin-mcp` bridge with the user's
 * own access token. It never reads cookies, so it is exempt from the Origin check that protects cookie sessions; a
 * browser Origin other than the dashboard's is still refused (DNS rebinding).
 */
export async function handleMcpRequest(request: Request) {
  if (request.method !== "POST") return rpcError(405, "Use POST.", { allow: "POST" })
  if (!process.env.ADMIN_MCP_CLIENT_ID && !isAgentMode()) return rpcError(503, "The admin MCP is not configured.")
  const origin = request.headers.get("origin")
  if (origin !== null && origin !== resolveAppOrigin(process.env, process.env.NODE_ENV)) {
    return rpcError(403, "Untrusted origin.")
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return rpcError(415, "Send application/json.")
  }
  const authorization = request.headers.get("authorization")
  const accessToken = authorization ? (BEARER.exec(authorization)?.[1] ?? "") : null
  if (accessToken === "") return rpcError(401, "Malformed Authorization header.")
  const body = await readLimited(request)
  if (body === null) return rpcError(413, "The request is too large or too slow.")
  let parsed: z.core.util.JSONType
  try {
    parsed = z.json().parse(JSON.parse(body))
  } catch (error) {
    console.error(error)
    return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } })
  }
  try {
    const result = await handleMcpMessages(parsed, { accessToken, idToken: request.headers.get(MCP_ID_TOKEN_HEADER) })
    return json(result.status, result.body)
  } catch (error) {
    if (error instanceof McpCallerError) {
      const challenge: Record<string, string> =
        error.status === 401 ? { "www-authenticate": 'Bearer error="invalid_token"' } : {}
      return rpcError(error.status, error.message, challenge)
    }
    console.error(error)
    return rpcError(500, "Internal error.")
  }
}
