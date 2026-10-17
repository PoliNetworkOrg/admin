import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env"

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
 * Forwards the sign agent's calls to the backend's `/esign/agent/…`. The agent reaches the dashboard's public origin,
 * not the in-cluster backend. Nothing from the browser session is used or forwarded.
 */
async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const path = params._splat ?? ""
  if (!AGENT_PATH.test(path)) return json(404, { error: { code: "not_found", message: "Not found" } })
  let body: string | undefined
  if (request.method === "POST") {
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json"))
      return json(415, { error: { code: "bad_request", message: "Send JSON" } })
    body = await request.text()
    if (body.length > MAX_BODY_BYTES) return json(413, { error: { code: "bad_request", message: "Too large" } })
  }
  try {
    const response = await fetch(`${env.BACKEND_URL}/esign/agent/${path}`, {
      method: request.method,
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
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
