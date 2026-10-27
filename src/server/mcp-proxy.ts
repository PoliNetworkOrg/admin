import { TRPCClientError } from "@trpc/client"
import { SuperJSON } from "superjson"
import { z } from "zod"

import { backendPath, canUseTool, rpcMethod, tools } from "../mcp/catalog"
import { MCP_RPC_PATH } from "../mcp/protocol"

const MAX_BODY = 72 * 1024 * 1024
export const mcpAccessSchema = z.object({ permissions: z.array(z.string()), stale: z.boolean() })
export type McpAccess = z.infer<typeof mcpAccessSchema>

export interface McpProxyServices {
  origin: string
  backendUrl: string
  trpcPath: string
  access: (token: string) => Promise<McpAccess>
  fetch: typeof fetch
}

const errorCodes = new Map([
  [400, { code: -32600, name: "BAD_REQUEST" }],
  [401, { code: -32001, name: "UNAUTHORIZED" }],
  [403, { code: -32003, name: "FORBIDDEN" }],
  [404, { code: -32004, name: "NOT_FOUND" }],
  [405, { code: -32005, name: "METHOD_NOT_SUPPORTED" }],
  [413, { code: -32013, name: "PAYLOAD_TOO_LARGE" }],
  [415, { code: -32015, name: "UNSUPPORTED_MEDIA_TYPE" }],
  [502, { code: -32052, name: "BAD_GATEWAY" }],
  [503, { code: -32053, name: "SERVICE_UNAVAILABLE" }],
])

export function mcpRpcFailure(status: number, message: string) {
  const error = errorCodes.get(status) ?? { code: -32603, name: "INTERNAL_SERVER_ERROR" }
  return Response.json(
    { error: SuperJSON.serialize({ message, code: error.code, data: { code: error.name, httpStatus: status } }) },
    {
      status,
      headers: { "cache-control": "no-store" },
    }
  )
}

const failure = mcpRpcFailure

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new Error("Request too large.")
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  let bytes = 0
  const chunks: Uint8Array[] = []
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    void reader.cancel()
  }, 10_000)
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.length
      if (bytes > MAX_BODY) {
        await reader.cancel()
        throw new Error("Request too large.")
      }
      chunks.push(part.value)
    }
    if (timedOut) throw new Error("Upload timed out.")
    return Buffer.concat(chunks)
  } finally {
    clearTimeout(timer)
  }
}

/** A cookie-free gateway for the local OAuth client, limited to dashboard RPCs and exact HTTP methods. */
export async function proxyMcpRpc(request: Request, services: McpProxyServices) {
  const url = new URL(request.url)
  const path = url.pathname.slice(`${MCP_RPC_PATH}/`.length)
  if (!url.pathname.startsWith(`${MCP_RPC_PATH}/`) || !/^[A-Za-z][A-Za-z0-9_.]*$/.test(path))
    return failure(404, "Not found.")
  const method = rpcMethod(path)
  if (!method) return failure(404, "Not found.")
  if (request.method !== method) return failure(405, "Method not allowed.")
  if ([...url.searchParams.keys()].some((key) => key !== "input"))
    return failure(400, "Batch requests are not supported.")
  const origin = request.headers.get("origin")
  if (origin !== null && origin !== services.origin) return failure(403, "Untrusted origin.")
  const token = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]
  if (!token) return failure(401, "Sign in to use the admin MCP.")
  try {
    const access = mcpAccessSchema.parse(await services.access(token))
    if (access.stale) return failure(503, "Permissions are temporarily unavailable.")
    const permitted =
      path === "esign.profile.sync"
        ? access.permissions.includes("admin:access") && access.permissions.includes("esign:sign")
        : path === "me.access"
          ? access.permissions.includes("admin:access") || access.permissions.includes("people:self")
          : tools.some((tool) => backendPath(tool) === path && canUseTool(tool, access.permissions))
    if (!permitted) return failure(403, "This account cannot use this operation.")
  } catch (error) {
    console.error(new Error(error instanceof Error ? error.message : "Authorization failed"))
    if (error instanceof TRPCClientError && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.data?.code)) {
      return failure(error.data.code === "UNAUTHORIZED" ? 401 : 403, "Access denied.")
    }
    return failure(503, "Authorization is temporarily unavailable.")
  }
  const headers = new Headers({ authorization: `Bearer ${token}`, accept: "application/json" })
  let body: Uint8Array | undefined
  if (method === "POST") {
    const contentType = request.headers.get("content-type") ?? ""
    if (!/^(?:application\/json|multipart\/form-data)(?:;|$)/i.test(contentType))
      return failure(415, "Send JSON or multipart form data.")
    headers.set("content-type", contentType)
    try {
      body = await readBody(request)
    } catch (error) {
      console.error(error)
      return failure(413, "Upload is too large or timed out.")
    }
  }
  try {
    const response = await services.fetch(`${services.backendUrl}${services.trpcPath}/${path}${url.search}`, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    })
    // A backend redirect is never exposed with a credential-bearing destination.
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      return failure(502, "Unexpected backend redirect.")
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    console.error(new Error(error instanceof Error ? error.message : "Backend unavailable"))
    return failure(
      502,
      "Backend unavailable. A submitted mutation may already have succeeded; inspect the record before retrying."
    )
  }
}
