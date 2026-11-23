import type { Readable, Writable } from "node:stream"

import { z } from "zod"

import {
  MCP_ID_TOKEN_HEADER,
  MCP_MAX_MESSAGE_BYTES,
  MCP_NAME,
  MCP_PATH,
  MCP_REFRESH_TOOL,
  MCP_VERSION,
} from "../protocol.ts"
import type { BridgeCredentials } from "./auth.ts"
import { LOGIN_HINT, SignInRequired } from "./auth.ts"

type Json = z.core.util.JSONType

const idSchema = z.union([z.string(), z.number()])
/** A request: a message with a method and an id (notifications and the client's responses have no answer). */
const requestSchema = z.object({
  id: idSchema,
  method: z.string(),
  params: z.looseObject({ name: z.string().optional(), protocolVersion: z.string().optional() }).optional(),
})
type Request = z.infer<typeof requestSchema>
/** The parts of the admin's answers the bridge reads. An answer has no method: only requests and notifications do. */
const answerSchema = z.object({
  id: idSchema.nullish(),
  method: z.undefined().optional(),
  result: z.looseObject({ protocolVersion: z.string().optional(), isError: z.boolean().optional() }).optional(),
  error: z.looseObject({ message: z.string() }).optional(),
})

/** Newest first, as the admin's endpoint accepts them; used to answer `initialize` while signed out. */
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

const AUTH_ERROR = -32001
const TRANSPORT_ERROR = -32000

export type BridgeOptions = {
  /** The admin's origin, already validated. */
  origin: string
  /**
   * Credentials for the next request; `rejected` is an access token the admin refused. Throws `SignInRequired`.
   * Null sends no credentials: only for development against a loopback agent-mode server.
   */
  credentials: (rejected?: string) => Promise<BridgeCredentials | null>
  input: Readable
  output: Writable
  userAgent: string
  /** Milliseconds; uploads go through `tools/call`, so it waits longest. */
  timeouts?: { call: number; other: number }
}

function errorResponse(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

/** Each `data:` event of a `text/event-stream` body: one JSON-RPC message (or batch) per event. */
function eventData(body: string) {
  const events: string[] = []
  for (const block of body.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
    if (data.length > 0) events.push(data.join("\n"))
  }
  return events
}

class NetworkError extends Error {}

/** What a request the admin left without an answer is told. */
function unanswered(request: Request) {
  return request.method === "tools/call"
    ? "The admin did not answer. The operation may have run anyway: read the record before trying again."
    : "The admin did not answer. Try again."
}

/**
 * The input's lines as bytes, without their `\n` (and `\r`). A line longer than `limit` comes back as null once it
 * ends, without being kept in memory.
 */
async function* readLines(input: Readable, limit: number): AsyncGenerator<Buffer<ArrayBuffer> | null> {
  let parts: Buffer[] = []
  let size = 0
  for await (const data of input) {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(String(data))
    let start = 0
    for (let end = chunk.indexOf(10, start); end !== -1; end = chunk.indexOf(10, start)) {
      const tail = chunk.subarray(start, end)
      const line = size + tail.length > limit ? null : Buffer.concat([...parts, tail])
      parts = []
      size = 0
      start = end + 1
      yield line && line.at(-1) === 13 ? line.subarray(0, -1) : line
    }
    const rest = chunk.subarray(start)
    size += rest.length
    if (size <= limit) parts.push(rest)
    else parts = []
  }
  if (size > 0) yield size > limit ? null : Buffer.concat(parts)
}

/**
 * The local stdio MCP server: newline-delimited JSON-RPC from the client, each message POSTed to the admin's
 * `/api/mcp` with the user's own tokens, each answer written back as one line. Messages run concurrently; stdout
 * carries nothing but JSON-RPC. Resolves once the input has closed and every message has its answer.
 */
export async function runBridge(options: BridgeOptions) {
  const { origin, output, userAgent } = options
  const timeouts = options.timeouts ?? { call: 120_000, other: 30_000 }
  const pending = new Set<Promise<void>>()
  let protocolVersion: string | null = null

  function write(message: Json) {
    output.write(`${JSON.stringify(message)}\n`)
  }

  /** What the bridge answers itself when it cannot reach the admin as the user. */
  function answerSignedOut(requests: Request[], message: string) {
    for (const request of requests) {
      if (request.method === "initialize") {
        const requested = request.params?.protocolVersion ?? ""
        protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]
        write({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion,
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: MCP_NAME, title: "PoliNetwork Admin", version: MCP_VERSION },
            instructions: `Not connected: ${message}`,
          },
        })
      } else if (request.method === "ping") {
        write({ jsonrpc: "2.0", id: request.id, result: {} })
      } else {
        write(errorResponse(request.id, AUTH_ERROR, message))
      }
    }
  }

  async function post(body: Buffer<ArrayBuffer>, credentials: BridgeCredentials | null, timeout: number) {
    const headers = new Headers({
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": userAgent,
    })
    if (protocolVersion) headers.set("mcp-protocol-version", protocolVersion)
    if (credentials) {
      headers.set("authorization", `Bearer ${credentials.accessToken}`)
      headers.set(MCP_ID_TOKEN_HEADER, credentials.idToken)
    }
    try {
      const response = await fetch(`${origin}${MCP_PATH}`, {
        method: "POST",
        headers,
        body,
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(timeout),
      })
      return { status: response.status, type: response.headers.get("content-type") ?? "", text: await response.text() }
    } catch (error) {
      console.error(error)
      throw new NetworkError(
        error instanceof Error && error.name === "TimeoutError"
          ? `The admin did not answer within ${timeout / 1000} seconds.`
          : `The admin at ${origin} could not be reached.`
      )
    }
  }

  /** Writes the admin's answer, with each error put on the request it belongs to. */
  function deliver(response: Awaited<ReturnType<typeof post>>, requests: Request[]) {
    if (response.status === 202) return
    let messages: Json[]
    try {
      const bodies = response.type.startsWith("text/event-stream") ? eventData(response.text) : [response.text]
      messages = bodies.flatMap((body): Json[] => {
        const parsed = z.json().parse(JSON.parse(body))
        return Array.isArray(parsed) ? parsed : [parsed]
      })
    } catch (error) {
      console.error(error)
      messages = []
    }
    if (response.status !== 200) {
      const detail = messages.map((entry) => answerSchema.safeParse(entry).data?.error).find(Boolean)
      const message = detail?.message ?? `The admin answered HTTP ${response.status}.`
      for (const request of requests) write(errorResponse(request.id, TRANSPORT_ERROR, message))
      if (requests.length === 0) console.error(message)
      return
    }
    let announce = false
    const waiting = new Set(requests)
    for (const message of messages) {
      const answer = answerSchema.safeParse(message).data
      const request = [...waiting].find((entry) => entry.id === answer?.id)
      // Only one answer per request sent reaches the client: the admin has no say in anything else the client does
      // (its own requests, such as sampling, elicitation or roots, and its notifications are dropped).
      if (!request || !answer || (!answer.result && !answer.error)) {
        console.error(new Error("Dropped a message from the admin that answers no request."))
        continue
      }
      waiting.delete(request)
      write(message)
      if (!answer.result) continue
      if (request.method === "initialize") protocolVersion = answer.result.protocolVersion ?? null
      if (request.method === "tools/call" && request.params?.name === MCP_REFRESH_TOOL && !answer.result.isError) {
        announce = true
      }
    }
    for (const request of waiting) write(errorResponse(request.id, TRANSPORT_ERROR, unanswered(request)))
    // Permissions changed: the client reloads the tool list.
    if (announce) write({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })
  }

  async function forward(line: Buffer<ArrayBuffer>) {
    let message: Json
    try {
      message = z.json().parse(JSON.parse(line.toString("utf8")))
    } catch (error) {
      console.error(error)
      write(errorResponse(null, -32700, "Parse error."))
      return
    }
    const requests = (Array.isArray(message) ? message : [message]).flatMap(
      (entry) => requestSchema.safeParse(entry).data ?? []
    )
    // A write may have happened if the connection broke during a tool call: never send it twice.
    const once = requests.some((request) => request.method === "tools/call")
    const timeout = once ? timeouts.call : timeouts.other
    try {
      let credentials = await options.credentials()
      let response = await post(line, credentials, timeout).catch((error) => {
        if (once || !(error instanceof NetworkError)) throw error
        console.error(error)
        return post(line, credentials, timeout)
      })
      // The admin authenticates before it runs anything: a refused token is renewed and the message resent once.
      if (response.status === 401 && credentials) {
        credentials = await options.credentials(credentials.accessToken)
        response = await post(line, credentials, timeout)
        if (response.status === 401) throw new SignInRequired(`The admin refused the session. ${LOGIN_HINT}`)
      }
      deliver(response, requests)
    } catch (error) {
      if (error instanceof SignInRequired) {
        answerSignedOut(requests, error.message)
        return
      }
      console.error(error)
      const reason = error instanceof NetworkError ? error.message : "The bridge failed."
      for (const request of requests) {
        const uncertain =
          request.method === "tools/call"
            ? " The operation may have run anyway: read the record before trying again."
            : " Try again."
        write(errorResponse(request.id, TRANSPORT_ERROR, `${reason}${uncertain}`))
      }
    }
  }

  for await (const line of readLines(options.input, MCP_MAX_MESSAGE_BYTES)) {
    if (line === null) {
      const limit = `The message is larger than the admin accepts (${MCP_MAX_MESSAGE_BYTES / 1024 / 1024} MB).`
      write(errorResponse(null, -32600, limit))
      continue
    }
    if (line.length === 0) continue
    const task = forward(line).finally(() => pending.delete(task))
    pending.add(task)
  }
  // The client closed its end (MCP's shutdown): answer what is in flight, each bounded by its timeout, then stop.
  await Promise.allSettled(pending)
}
