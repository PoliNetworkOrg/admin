import { Server, type CallToolResult, type Tool } from "@modelcontextprotocol/server"
import { createTRPCUntypedClient, httpLink, isNonJsonSerializable } from "@trpc/client"
import { SuperJSON } from "superjson"
import { z } from "zod"

import {
  prepareReceiptSignaturesInputSchema,
  receiptSignaturesMatchSelection,
  receiptSignaturesSchema,
} from "../features/people/people.contract"
import { backendPath, canUseTool, multipartInput, toolName, tools, type ToolDefinition } from "./catalog"
import { uploadForm } from "./files"
import { MCP_NAME, MCP_RPC_PATH, MCP_VERSION, type SignerProfile } from "./protocol"

export interface AdminApi {
  // The registry parses each heterogeneous RPC's input and output with its own schema at the call boundary.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns
  query(path: string, input?: unknown): Promise<unknown>
  // oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns
  mutation(path: string, input?: unknown): Promise<unknown>
}

export function createAdminApi(
  origin: string,
  token: () => Promise<string>,
  profile?: () => Promise<SignerProfile>
): AdminApi {
  const client = createTRPCUntypedClient({
    links: [
      httpLink({
        url: `${origin}${MCP_RPC_PATH}`,
        headers: async () => ({ authorization: `Bearer ${await token()}` }),
        transformer: {
          serialize: (value) => (isNonJsonSerializable(value) ? value : SuperJSON.serialize(value)),
          deserialize: (value) => SuperJSON.deserialize(value),
        },
        // No cookies, automatic retries or credential-bearing redirects.
        fetch: (url, init) =>
          fetch(url, { ...init, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(60_000) }),
      }),
    ],
  })
  const syncProfile = async (path: string) => {
    if (profile && path.startsWith("esign.")) await client.mutation("esign.profile.sync", await profile())
  }
  return {
    query: async (path, input) => {
      await syncProfile(path)
      return client.query(path, input)
    },
    mutation: async (path, input) => {
      await syncProfile(path)
      return client.mutation(path, input)
    },
  }
}

const accessSchema = z.object({ sub: z.string().min(1), permissions: z.array(z.string()), stale: z.boolean() })
const backendErrorSchema = z.object({ error: z.string().nullable().optional() })

function description(tool: ToolDefinition): Tool {
  const schema = z.toJSONSchema(tool.input, { io: "input" })
  if (schema.type !== "object") throw new Error(`Tool ${tool.path} must accept an object.`)
  return {
    name: toolName(tool),
    description: tool.description,
    // SAFETY: Zod generated an object JSON schema; JSON serialization removes its non-JSON helper properties.
    inputSchema: JSON.parse(JSON.stringify(schema)) as Tool["inputSchema"],
    annotations: {
      readOnlyHint: tool.method === "query",
      destructiveHint: tool.destructive ?? false,
      idempotentHint: tool.method === "query",
      openWorldHint: true,
    },
  }
}

// The output of a heterogeneous RPC is serialized only after its optional contract schema has parsed it.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function result(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(SuperJSON.serialize(value)) }] }
}

/** me.access is read afresh even for tools/list. A stale access snapshot always fails closed. */
async function currentAccess(api: AdminApi) {
  const access = accessSchema.parse(await api.query("me.access"))
  if (access.stale) throw new Error("Permissions are temporarily unavailable. Try again later.")
  if (!access.permissions.includes("admin:access") && !access.permissions.includes("people:self")) {
    throw new Error("This account cannot access the admin dashboard.")
  }
  return access
}

export function createAdminMcpServer(api: AdminApi) {
  const server = new Server(
    { name: MCP_NAME, version: MCP_VERSION },
    {
      capabilities: { tools: { listChanged: true } },
      instructions:
        "Act for the signed-in PoliNetwork user, with their dashboard permissions. Read records before editing. Ask before destructive changes; never perform destructive actions on multiple rows without an explicit instruction covering them. Every mutation requires confirmed=true after the user has authorized that exact change. Never retry a mutation automatically: a network failure may follow a successful write. Files use explicit base64 bytes, never local paths. CIE signing still requires the person and the existing signing agent; never ask for their PIN. Some People procedures depend on a backend contract that may not yet be deployed.",
    }
  )
  server.setRequestHandler("tools/list", async () => {
    const access = await currentAccess(api)
    return {
      tools: [
        {
          name: "whoami",
          description: "Read the signed-in subject and current dashboard permissions.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true },
        },
        ...tools
          .filter((tool) => canUseTool(tool, access.permissions))
          .map((tool) => {
            const spec = description(tool)
            if (tool.method === "mutation") {
              // SAFETY: This wraps an already checked JSON schema; the SDK's JSON type has a fixed recursion depth.
              spec.inputSchema = JSON.parse(
                JSON.stringify({
                  type: "object",
                  properties: {
                    input: spec.inputSchema,
                    confirmed: { type: "boolean", const: true, description: "The user authorized this exact change." },
                  },
                  required: ["input", "confirmed"],
                  additionalProperties: false,
                })
              ) as Tool["inputSchema"]
            }
            return spec
          }),
      ],
    }
  })
  server.setRequestHandler("tools/call", async (request) => {
    try {
      const access = await currentAccess(api)
      if (request.params.name === "whoami") return result(access)
      const tool = tools.find((entry) => toolName(entry) === request.params.name)
      if (!tool || !canUseTool(tool, access.permissions))
        throw new Error("This operation is unavailable to your account.")
      const raw =
        tool.method === "mutation"
          ? z
              .object({ input: z.unknown(), confirmed: z.literal(true) })
              .strict()
              .parse(request.params.arguments).input
          : (request.params.arguments ?? {})
      const parsed: unknown = tool.input.parse(raw)
      const input = tool.multipart ? await uploadForm(backendPath(tool), multipartInput.parse(parsed)) : parsed
      const body = Object.keys(z.record(z.string(), z.unknown()).parse(parsed)).length === 0 ? undefined : input
      const response = await api[tool.method](backendPath(tool), body)
      const error = backendErrorSchema.safeParse(response)
      if (error.success && error.data.error) throw new Error(error.data.error)
      if (tool.path === "people.receipts.prepareSignatures") {
        const selection = prepareReceiptSignaturesInputSchema.parse(raw)
        const signatures = receiptSignaturesSchema.parse(response)
        if (!receiptSignaturesMatchSelection(selection.receiptIds, signatures)) {
          throw new Error("The signing requests do not exactly match the selected receipts.")
        }
      }
      if (
        ["tg.groups.setHide", "wa.groups.setHide", "wa.groups.modify", "wa.groups.delete"].includes(tool.path) &&
        !response
      ) {
        throw new Error("The record was not updated.")
      }
      if (
        [
          "groups.labels.create",
          "groups.labels.createRelease",
          "groups.labels.modify",
          "groups.labels.rename",
        ].includes(tool.path) &&
        (!Array.isArray(response) || response.length === 0)
      ) {
        throw new Error("The label was not saved.")
      }
      return result(tool.output ? tool.output.parse(response) : response)
    } catch (error) {
      // Log the message only: OAuth and HTTP error objects can contain authorization headers.
      const message = error instanceof Error ? error.message : "The operation failed."
      console.error(new Error(error instanceof Error ? error.message : "The operation failed."))
      return { isError: true, content: [{ type: "text", text: message }] }
    }
  })
  return server
}
