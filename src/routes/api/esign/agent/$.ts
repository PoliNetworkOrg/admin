import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env"
import { agentUserAgent } from "@/features/esign/agent"

/** `jobs/{ticket}` and its actions: the only backend paths the agent may reach. */
const AGENT_PATH = /^jobs\/[A-Za-z0-9_-]{43}(?:\/(?:prepare|complete|fail))?$/
const MAX_BODY_BYTES = 256 * 1024

function json(status: number, body: { error: { code: string; message: string } }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

/**
 * Reads at most MAX_BODY_BYTES within 10 seconds, stopping as soon as the limit is passed: anyone can reach this
 * route, so an oversized or slow body must not be buffered. Null when too large or too slow.
 */
async function readLimited(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  let timedOut = false
  const deadline = setTimeout(() => {
    timedOut = true
    void reader.cancel()
  }, 10_000)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } catch (error) {
    console.error(error)
    return null
  } finally {
    clearTimeout(deadline)
  }
  // A cancelled stream ends early: never forward a truncated body.
  if (timedOut) return null
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Forwards the sign agent's calls to the backend's `/esign/agent/…`. The agent reaches the dashboard's public origin,
 * not the in-cluster backend. Nothing from the browser session is used or forwarded; the agent's own User-Agent is,
 * so the backend can tell its version.
 */
async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const path = params._splat ?? ""
  if (!AGENT_PATH.test(path)) return json(404, { error: { code: "not_found", message: "Not found" } })
  let body: string | undefined
  if (request.method === "POST") {
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json"))
      return json(415, { error: { code: "bad_request", message: "Send JSON" } })
    const read = await readLimited(request)
    if (read === null) return json(413, { error: { code: "bad_request", message: "Too large" } })
    body = read
  }
  const headers = new Headers({ accept: "application/json" })
  if (body !== undefined) headers.set("content-type", "application/json")
  const userAgent = agentUserAgent(request.headers.get("user-agent"))
  if (userAgent) headers.set("user-agent", userAgent)
  try {
    const response = await fetch(`${env.BACKEND_URL}/esign/agent/${path}`, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    })
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    })
  } catch (error) {
    console.error(error)
    return json(502, {
      error: { code: "backend_unreachable", message: "The signing service is unavailable. Try again shortly." },
    })
  }
}

export const Route = createFileRoute("/api/esign/agent/$")({
  server: { handlers: { GET: proxy, POST: proxy } },
})
