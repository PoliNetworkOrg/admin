import { isRedirect } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { z } from "zod"

import { runAsMcpRequest } from "@/server/mcp-request.server"

import { ACCESS_TTL_MS, type McpCaller, McpCallerError, resolveCaller } from "./caller.server"
import { areaOf, GUARDS, type Operation, type OperationKind } from "./operation"
import { OPERATIONS } from "./operations"
import { MCP_NAME, MCP_REFRESH_TOOL, MCP_VERSION } from "./protocol"

/** Newest first; an unknown requested version gets the newest. */
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

const INSTRUCTIONS = `PoliNetwork's admin dashboard, acting as the signed-in user with their current dashboard permissions: the same operations, checks and records as the dashboard.
- list_operations shows the operations this account may use, grouped by area; pass an area (or operation names) to get their input schemas. run_read, run_write and run_destructive run one operation each, with its input.
- Read a record before changing it, and change only what the user asked for. Ask before every destructive operation, and never run one on more than one record without an explicit instruction covering all of them.
- Never retry a failed write automatically: read the record first, since it may already have changed.
- If the user says they now have a permission the list lacks, call ${MCP_REFRESH_TOOL}.
- Files travel as base64 in the input; this server never reads local paths. CIE signatures still need the person, their card and the PoliNetwork eSign app: never ask for a PIN.`

type RunTool = { name: string; title: string; description: string }

const RUN_TOOLS = {
  read: {
    name: "run_read",
    title: "Read from the dashboard",
    description: "Run one read operation. It changes nothing.",
  },
  write: {
    name: "run_write",
    title: "Change the dashboard",
    description: "Run one write operation, after reading the record it changes. Never retry a failure automatically.",
  },
  destructive: {
    name: "run_destructive",
    title: "Delete or end in the dashboard",
    description:
      "Run one destructive operation (delete, end, revoke, reject, send). Ask the user first; one record per call unless they explicitly asked for more.",
  },
} satisfies Record<OperationKind, RunTool>

const KINDS = ["read", "write", "destructive"] as const satisfies readonly OperationKind[]

type JsonSchema = z.core.JSONSchema.JSONSchema
type JsonValue = z.core.util.JSONType
type JsonRpcId = string | number

/** A tools/call result: JSON text the agent reads. */
export type ToolResult = { content: { type: "text"; text: string }[]; isError: boolean }

type McpTool = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean }
}

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: object }
  | { jsonrpc: "2.0"; id: JsonRpcId | null; error: { code: number; message: string } }

const jsonRecord = z.record(z.string(), z.json())
const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: jsonRecord.optional(),
})
type JsonRpcRequest = z.infer<typeof requestSchema> & { id: JsonRpcId }
const responseSchema = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]) })
const initializeSchema = z.object({ protocolVersion: z.string().optional() })
const callSchema = z.object({ name: z.string(), arguments: jsonRecord.optional() })
const runArgumentsSchema = z.object({ operation: z.string(), input: jsonRecord.optional() }).strict()
const listArgumentsSchema = z
  .object({ area: z.string().optional(), operations: z.array(z.string()).max(50).optional() })
  .strict()
const fileSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^/\\]+$/, "A file name, not a path."),
    type: z.string().min(1).max(100),
    base64: z.base64(),
  })
  .strict()
const formFieldsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
const filesSchema = z.record(z.string(), z.union([fileSchema, z.array(fileSchema)]))
const trpcCodeSchema = z.object({ code: z.string() })

const EMPTY_SCHEMA: JsonSchema = { type: "object", properties: {}, additionalProperties: false }

function available(caller: McpCaller) {
  return OPERATIONS.filter((operation) => GUARDS[operation.guard](caller.access.permissions))
}

/** JSON Schema every MCP client accepts: no `$schema`, `const` as a one-value `enum`, no safe-integer bounds. */
function portableSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _dialect, ...json } = z.toJSONSchema(schema, {
    io: "input",
    target: "draft-07",
    unrepresentable: "any",
    override: ({ jsonSchema }) => {
      if (jsonSchema.const !== undefined) {
        jsonSchema.enum = [jsonSchema.const]
        delete jsonSchema.const
      }
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum
      if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) delete jsonSchema.minimum
    },
  })
  return json
}

const FILE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "File name, e.g. logo.png" },
    type: { type: "string", description: "MIME type, e.g. application/pdf" },
    base64: { type: "string", description: "The file's bytes, base64-encoded" },
  },
  required: ["name", "type", "base64"],
  additionalProperties: false,
}

/** The operation's input; an upload's also has `files`, each file as name, MIME type and base64 bytes. */
function inputSchema(operation: Operation): JsonSchema {
  const base = operation.input ? portableSchema(operation.input) : EMPTY_SCHEMA
  if (!operation.files) return base
  const files: Record<string, JsonSchema> = {}
  for (const entry of operation.files) {
    files[entry.field] = entry.multiple
      ? { type: "array", items: FILE_SCHEMA, minItems: entry.required ? 1 : 0, description: entry.description }
      : { ...FILE_SCHEMA, description: entry.description }
  }
  return {
    ...base,
    type: "object",
    properties: {
      ...base.properties,
      files: {
        type: "object",
        properties: files,
        required: operation.files.filter((entry) => entry.required).map((entry) => entry.field),
        additionalProperties: false,
      },
    },
    required: [...(base.required ?? []), "files"],
  }
}

type OperationSummary = { name: string; kind: OperationKind; description: string; input?: JsonSchema }

function describe(operation: Operation, withSchema: boolean) {
  const summary: OperationSummary = {
    name: operation.name,
    kind: operation.kind,
    description: operation.description,
  }
  if (withSchema) summary.input = inputSchema(operation)
  return summary
}

function tools(caller: McpCaller) {
  const operations = available(caller)
  const areas = [...new Set(operations.map(areaOf))].toSorted()
  const list: McpTool[] = [
    {
      name: "whoami",
      title: "Who am I",
      description: "The signed-in account and its current dashboard permissions.",
      inputSchema: EMPTY_SCHEMA,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: MCP_REFRESH_TOOL,
      title: "Reload permissions",
      description: `Reload this account's permissions now instead of within ${ACCESS_TTL_MS / 60_000} minutes, e.g. when the user says they have just been given one. The tool list then changes to match.`,
      inputSchema: EMPTY_SCHEMA,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: "list_operations",
      title: "List dashboard operations",
      description:
        "The operations this account may use, by area. With `area` or `operations`, each one's input schema too.",
      inputSchema: {
        type: "object",
        properties: {
          area: { type: "string", enum: areas, description: "Only this area, with input schemas." },
          operations: {
            type: "array",
            items: { type: "string" },
            maxItems: 50,
            description: "Only these operations, with input schemas.",
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
  ]
  for (const kind of KINDS) {
    const names = operations.filter((operation) => operation.kind === kind).map((operation) => operation.name)
    if (names.length === 0) continue
    const tool = RUN_TOOLS[kind]
    list.push({
      ...tool,
      description: `${tool.description} Input schemas: list_operations.`,
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: names },
          input: { type: "object", description: "The operation's input, as list_operations describes it." },
        },
        required: ["operation"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: kind === "read",
        destructiveHint: kind === "destructive",
        idempotentHint: kind === "read",
        openWorldHint: true,
      },
    })
  }
  return list
}

function text(value: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: value }], isError }
}

/** Results as JSON: dates as ISO strings, bytes as base64. */
// The server functions' results are heterogeneous; this only serializes them.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function serialize(value: unknown) {
  return JSON.stringify(value ?? null, (_key, current) => {
    if (current instanceof Uint8Array) return { base64: Buffer.from(current).toString("base64") }
    if (current instanceof Map) return Object.fromEntries(current)
    if (current instanceof Set) return [...current]
    return current
  })
}

/** An upload's fields and base64 files as the FormData its server function validates, as the dashboard sends it. */
function formData(operation: Operation, fields: z.infer<typeof formFieldsSchema>, rawFiles: JsonValue | undefined) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== null) form.set(key, String(value))
  for (const [field, value] of Object.entries(filesSchema.parse(rawFiles ?? {}))) {
    const spec = operation.files?.find((entry) => entry.field === field)
    if (!spec) throw new Error(`Unknown file field: ${field}.`)
    const entries = Array.isArray(value) ? value : [value]
    if (!spec.multiple && entries.length > 1) throw new Error(`Send one file in ${field}.`)
    for (const entry of entries) {
      form.append(field, new File([Buffer.from(entry.base64, "base64")], entry.name, { type: entry.type }))
    }
  }
  for (const spec of operation.files ?? []) {
    if (spec.required && !form.has(spec.field)) throw new Error(`Add a file in ${spec.field}.`)
  }
  return form
}

const DENIED =
  "This account may not run this operation. If the user has just been given the permission, call refresh_permissions and try again."

/** Errors the agent can act on, without stack traces or backend internals. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function failure(operation: Operation, error: unknown) {
  if (isRedirect(error)) return text(DENIED, true)
  const code = error instanceof TRPCClientError ? (trpcCodeSchema.safeParse(error.data).data?.code ?? null) : null
  const message = error instanceof Error ? error.message : "The operation failed."
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return text(`${DENIED} (${message})`, true)
  if (code) return text(`${code}: ${message}`, true)
  if (message === "UNAUTHORIZED") return text(DENIED, true)
  // The backend did not answer with an error of its own: a write may have gone through.
  const uncertain =
    operation.kind === "read" ? "" : " The change may have been applied anyway: read the record before trying again."
  return text(`${message}${uncertain}`, true)
}

function operationInput(operation: Operation, raw: Record<string, JsonValue>) {
  if (!operation.files) return operation.input ? operation.input.parse(raw) : undefined
  const { files, ...fields } = raw
  return formData(operation, formFieldsSchema.parse(operation.input ? operation.input.parse(fields) : {}), files)
}

async function runOperation(caller: McpCaller, kind: OperationKind, args: Record<string, JsonValue>) {
  const parsed = runArgumentsSchema.safeParse(args)
  if (!parsed.success) return text(`Pass { operation, input }: ${z.prettifyError(parsed.error)}`, true)
  const operation = available(caller).find((entry) => entry.name === parsed.data.operation)
  if (!operation) {
    return text(
      `Unknown operation, or one this account may not run: ${parsed.data.operation}. See list_operations; if the user has just been given a permission, call refresh_permissions.`,
      true
    )
  }
  if (operation.kind !== kind) {
    return text(`${operation.name} is a ${operation.kind} operation: use ${RUN_TOOLS[operation.kind].name}.`, true)
  }
  let data: ReturnType<typeof operationInput>
  try {
    data = operationInput(operation, parsed.data.input ?? {})
  } catch (error) {
    console.error(error)
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : ""
    const schema = JSON.stringify(inputSchema(operation))
    return text(`Invalid input for ${operation.name}: ${detail}\nInput schema: ${schema}`, true)
  }
  try {
    return text(serialize(await runAsMcpRequest(caller, () => operation.run(data))))
  } catch (error) {
    console.error(error)
    return failure(operation, error)
  }
}

function listOperations(caller: McpCaller, args: Record<string, JsonValue>) {
  const parsed = listArgumentsSchema.safeParse(args)
  if (!parsed.success) return text(z.prettifyError(parsed.error), true)
  const { area, operations: names } = parsed.data
  const operations = available(caller).filter(
    (operation) => (!area || areaOf(operation) === area) && (!names || names.includes(operation.name))
  )
  const byArea = new Map<string, OperationSummary[]>()
  for (const operation of operations) {
    const summaries = byArea.get(areaOf(operation)) ?? []
    summaries.push(describe(operation, Boolean(area || names)))
    byArea.set(areaOf(operation), summaries)
  }
  return text(serialize(byArea))
}

function whoami(caller: McpCaller) {
  const { user, permissions } = caller.access
  return text(
    serialize({
      sub: user.sub,
      name: user.name,
      email: user.email,
      permissions,
      permissionsLoadedAt: new Date(caller.loadedAt).toISOString(),
    })
  )
}

export type McpCredentials = { accessToken: string | null; idToken: string | null }

async function refreshPermissions(previous: McpCaller, credentials: McpCredentials) {
  const caller = await resolveCaller(credentials, true)
  const before = new Set(previous.access.permissions)
  const after = new Set(caller.access.permissions)
  return text(
    serialize({
      permissions: caller.access.permissions,
      gained: [...after].filter((permission) => !before.has(permission)),
      lost: [...before].filter((permission) => !after.has(permission)),
    })
  )
}

function callTool(caller: McpCaller, credentials: McpCredentials, params: Record<string, JsonValue>) {
  const call = callSchema.parse(params)
  const args = call.arguments ?? {}
  if (call.name === "whoami") return whoami(caller)
  if (call.name === MCP_REFRESH_TOOL) return refreshPermissions(caller, credentials)
  if (call.name === "list_operations") return listOperations(caller, args)
  const kind = KINDS.find((entry) => RUN_TOOLS[entry].name === call.name)
  if (kind) return runOperation(caller, kind, args)
  return text(`Unknown tool: ${call.name}.`, true)
}

async function dispatch(
  request: JsonRpcRequest,
  caller: McpCaller,
  credentials: McpCredentials
): Promise<JsonRpcResponse> {
  const { id, method, params = {} } = request
  try {
    switch (method) {
      case "initialize": {
        const requested = initializeSchema.safeParse(params).data?.protocolVersion ?? ""
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: MCP_NAME, title: "PoliNetwork Admin", version: MCP_VERSION },
            instructions: INSTRUCTIONS,
          },
        }
      }
      case "ping":
        return { jsonrpc: "2.0", id, result: {} }
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: tools(caller) } }
      case "tools/call":
        return { jsonrpc: "2.0", id, result: await callTool(caller, credentials, params) }
      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }
    }
  } catch (error) {
    console.error(error)
    if (error instanceof McpCallerError) return { jsonrpc: "2.0", id, error: { code: -32001, message: error.message } }
    if (error instanceof z.ZodError) return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params." } }
    return { jsonrpc: "2.0", id, error: { code: -32603, message: "Internal error." } }
  }
}

const INVALID: JsonRpcResponse = { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request." } }

/** What `POST /api/mcp` answers: one response, a batch's, or an error of its own. */
export type McpResponseBody = JsonRpcResponse | JsonRpcResponse[]

/**
 * MCP messages from one HTTP request (Streamable HTTP, stateless, JSON responses only). Notifications and the
 * client's responses need no answer; every request runs as the caller.
 */
export async function handleMcpMessages(
  body: JsonValue,
  credentials: McpCredentials
): Promise<{ status: number; body: McpResponseBody | null }> {
  const batch = Array.isArray(body)
  const messages = Array.isArray(body) ? body : [body]
  if (messages.length === 0 || messages.length > 20) return { status: 400, body: INVALID }
  const requests: JsonRpcRequest[] = []
  for (const message of messages) {
    const parsed = requestSchema.safeParse(message)
    if (parsed.success) {
      if (parsed.data.id !== undefined) requests.push({ ...parsed.data, id: parsed.data.id })
    } else if (!responseSchema.safeParse(message).success) {
      return { status: 400, body: INVALID }
    }
  }
  if (requests.length === 0) return { status: 202, body: null }
  const caller = await resolveCaller(credentials)
  const responses = await Promise.all(requests.map((request) => dispatch(request, caller, credentials)))
  return { status: 200, body: batch ? responses : responses[0] }
}
