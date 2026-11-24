import type { z } from "zod"

import { hasPermission, type Permission } from "@/server/permissions"

/**
 * Who may see an operation: the same rule as the middleware of the server function it runs, for an account the
 * dashboard admits. Listing only; the server function's middleware and the backend still decide every call.
 * `tests/mcp.test.mjs` checks that each operation names its server function's middleware.
 */
const admin = (permissions: readonly string[]) => hasPermission(permissions, "admin:access")
const adminWith =
  (...required: Permission[]) =>
  (permissions: readonly string[]) =>
    admin(permissions) && required.every((permission) => hasPermission(permissions, permission))

export const GUARDS = {
  dashboardUserMiddleware: () => true,
  adminMiddleware: admin,
  peopleSelfMiddleware: (permissions: readonly string[]) => hasPermission(permissions, "people:self"),
  peopleReadMiddleware: adminWith("people:read"),
  peopleWriteMiddleware: adminWith("people:write"),
  peopleTeamReadMiddleware: (permissions: readonly string[]) =>
    adminWith("people:read")(permissions) || hasPermission(permissions, "people:self"),
  peopleTeamWriteMiddleware: (permissions: readonly string[]) =>
    adminWith("people:write")(permissions) || hasPermission(permissions, "people:self"),
  peopleAppointMiddleware: adminWith("people:appoint"),
  peopleLinkMiddleware: adminWith("people:link"),
  peopleInviteMiddleware: () => true,
  sociReadMiddleware: adminWith("soci:read"),
  sociWriteMiddleware: adminWith("soci:write"),
  grantsWriteMiddleware: adminWith("tg:grants:manage"),
  telegramGroupsWriteMiddleware: adminWith("tg:groups:manage"),
  whatsappGroupsWriteMiddleware: adminWith("wa:groups:manage"),
  labelsWriteMiddleware: adminWith("groups:labels:write"),
  webContentWriteMiddleware: adminWith("web:content:write"),
  reportsManageMiddleware: adminWith("web:reports:manage"),
  azureMembersReadMiddleware: adminWith("azure:members:read"),
  azureGroupsReadMiddleware: adminWith("azure:groups:read"),
  esignReadMiddleware: adminWith("esign:sign"),
  esignSignWriteMiddleware: adminWith("esign:sign"),
  esignDrivesManageMiddleware: adminWith("esign:sign", "esign:drives:manage"),
  esignRequestsManageMiddleware: adminWith("esign:sign", "esign:requests:manage"),
  regulationsAssigneeMiddleware: () => true,
  regulationsReadMiddleware: adminWith("regulations:read"),
  regulationsWriteMiddleware: adminWith("regulations:write"),
  regulationsManageMiddleware: adminWith("regulations:manage"),
  regulationsRectifyMiddleware: adminWith("regulations:rectify"),
} satisfies Record<string, (permissions: readonly string[]) => boolean>

export type Guard = keyof typeof GUARDS

/**
 * `read` changes nothing; `write` changes records; `destructive` deletes, ends, revokes, rejects or sends something
 * that can't be taken back. Each kind is its own MCP tool, so clients can ask before writes and always before
 * destructive operations.
 */
export type OperationKind = "read" | "write" | "destructive"

/** One file an upload operation accepts, sent as base64. Its server function validates it like the dashboard. */
export type UploadFile = {
  /** The FormData field the server function reads. */
  field: string
  required: boolean
  /** Several files in one field. */
  multiple?: boolean
  /** What to tell the agent: accepted types and size. */
  description: string
}

/** A server function as the registry calls it: with `{ data }` when it validates input, without otherwise. */
// The registry treats each server function's input and result as opaque: its own validator parses the input.
// oxlint-disable-next-line anti-slop/no-unknown-returns
type ServerFunction = (options: { data: never }) => Promise<unknown>

export type Operation = {
  /** `area.resource.action`, e.g. `whatsapp.groups.create`; the area is the first segment. */
  name: string
  kind: OperationKind
  description: string
  guard: Guard
  /**
   * The server function's own input schema (the same object its `.validator` uses). For an upload, the string form
   * fields besides the files. Absent: no input.
   */
  input?: z.ZodType
  /** An upload: the input's fields and `files` become the FormData the server function validates. */
  files?: readonly UploadFile[]
  // oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns
  run: (data: unknown) => Promise<unknown>
}

type Definition = {
  description: string
  guard: Guard
  input?: z.ZodType
  files?: readonly UploadFile[]
}

function define(name: string, kind: OperationKind, fn: ServerFunction, definition: Definition): Operation {
  return {
    name,
    kind,
    ...definition,
    // SAFETY: `data` is the output of `definition.input` (or the FormData built from it), the very schema the server
    // function validates with; the server function parses it again behind its middleware.
    run: (data) =>
      definition.input || definition.files ? fn({ data: data as never }) : fn({ data: undefined as never }),
  }
}

export function read(name: string, fn: ServerFunction, definition: Definition) {
  return define(name, "read", fn, definition)
}

export function write(name: string, fn: ServerFunction, definition: Definition) {
  return define(name, "write", fn, definition)
}

export function destructive(name: string, fn: ServerFunction, definition: Definition) {
  return define(name, "destructive", fn, definition)
}

export function areaOf(operation: Pick<Operation, "name">) {
  return operation.name.slice(0, operation.name.indexOf("."))
}
