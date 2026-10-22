import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"

import type { DashboardAccessState } from "@/lib/auth"
import { signInRedirect } from "@/lib/sign-in"
import { hasPermission, type Permission } from "@/server/permissions"

/** The session and a backend client that calls with the user's access token (RFC v3 §11). */
export const sessionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const [{ isAgentMode, readRequestSession }, { createBackendClient }, { setResponseHeader }] = await Promise.all([
    import("@/server/auth.server"),
    import("@/server/backend.server"),
    import("@tanstack/react-start/server"),
  ])
  setResponseHeader("Cache-Control", "private, no-store")
  setResponseHeader("Vary", "Cookie")
  const session = await readRequestSession()
  return next({
    context: { session, backend: createBackendClient(session?.accessToken ?? null), agentMode: isAgentMode() },
  })
})

export const dashboardAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    let dashboardAccess: DashboardAccessState = { status: "unauthenticated" }
    if (context.session) {
      const { loadAccess } = await import("@/server/auth.server")
      dashboardAccess = await loadAccess(context.session, context.backend)
    }
    return next({ context: { dashboardAccess } })
  })

export const authenticatedMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(({ next, context }) => {
    if (!context.session) throw signInRedirect()
    return next({ context: { session: context.session } })
  })

/**
 * Any dashboard user: `admin:access`, or `people:self` alone for the restricted People view. Functions add their own
 * permission on top; the backend checks every procedure again.
 */
export const dashboardUserMiddleware = createMiddleware({ type: "function" })
  .middleware([authenticatedMiddleware])
  .server(async ({ next, context }) => {
    const { loadAccess } = await import("@/server/auth.server")
    const access = await loadAccess(context.session, context.backend)
    if (access.status !== "authorized") throw redirect({ to: "/unauthorized" })
    return next({ context: { user: access.user, permissions: access.permissions } })
  })

/** Reads: the user holds `admin:access`. The backend checks the permission of every procedure on top. */
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([dashboardUserMiddleware])
  .server(({ next, context }) => {
    if (!hasPermission(context.permissions, "admin:access")) throw redirect({ to: "/unauthorized" })
    return next()
  })

function requirePermission(permissions: readonly string[], permission: Permission) {
  if (!hasPermission(permissions, permission)) throw new Error("UNAUTHORIZED")
}

/**
 * People: the signed-in person's own area (My area), and the Capo Admin and Team Lead views the backend scopes. These
 * (and the Team ones below) start from `dashboardUserMiddleware`, as volunteers have no `admin:access`; every other
 * People middleware starts from `adminMiddleware`, like the sections the navigation shows.
 */
export const peopleSelfMiddleware = createMiddleware({ type: "function" })
  .middleware([dashboardUserMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:self")
    return next()
  })

/** People: every record, admins, teams, census and linking, with contacts and HR notes. */
export const peopleReadMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:read")
    return next()
  })

/** People: add and edit people, admin roles, team memberships, the census and account linking. */
export const peopleWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:write")
    return next()
  })

/**
 * People › Teams writes: `people:write`, or a Team Lead (`people:self`) on their own team, which only the backend
 * can tell from the record.
 */
export const peopleTeamWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([dashboardUserMiddleware])
  .server(({ next, context }) => {
    const generalAccess =
      hasPermission(context.permissions, "admin:access") && hasPermission(context.permissions, "people:write")
    if (!generalAccess) requirePermission(context.permissions, "people:self")
    return next({
      context: {
        permissions: generalAccess
          ? context.permissions
          : context.permissions.filter((permission) => permission !== "people:write"),
      },
    })
  })

/** People › Teams reads: `people:read`, or a Team Lead (`people:self`) whose own team the backend returns. */
export const peopleTeamReadMiddleware = createMiddleware({ type: "function" })
  .middleware([dashboardUserMiddleware])
  .server(({ next, context }) => {
    const generalAccess =
      hasPermission(context.permissions, "admin:access") && hasPermission(context.permissions, "people:read")
    if (!generalAccess) requirePermission(context.permissions, "people:self")
    return next({
      context: {
        permissions: generalAccess
          ? context.permissions
          : context.permissions.filter((permission) => permission !== "people:read"),
      },
    })
  })

/** People › Member register: read. */
export const peopleMembersReadMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:members:read")
    return next()
  })

/** People › Member register: add members, change status and number, export. */
export const peopleMembersWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:members:write")
    return next()
  })

/** People: appoint Capo Admins and Team Leads. */
export const peopleAppointMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "people:appoint")
    return next()
  })

/** Telegram grants: create and interrupt. */
export const grantsWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "tg:grants:manage")
    return next()
  })

/** Telegram groups: hide and leave. */
export const telegramGroupsWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "tg:groups:manage")
    return next()
  })

/** WhatsApp groups: create, edit, delete, hide. */
export const whatsappGroupsWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "wa:groups:manage")
    return next()
  })

/** Group labels: create, edit, delete, tag and untag groups. */
export const labelsWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "groups:labels:write")
    return next()
  })

/** Website content: projects, associations, freshman guides, FAQs. */
export const webContentWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "web:content:write")
    return next()
  })

/** Group-link reports: list, resolve, dismiss (the backend requires the permission to read them too). */
export const reportsManageMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "web:reports:manage")
    return next()
  })

/** Microsoft 365: read the directory without modifying users or groups. */
export const azureMembersReadMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "azure:members:read")
    return next()
  })

/** Microsoft 365: create a new member through the backend's fixed workflow. */
export const azureMembersCreateMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "azure:members:create")
    return next()
  })

/** Microsoft 365: change the member number of an existing user, optionally emailing them. */
export const azureMembersWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "azure:members:write")
    return next()
  })

/** Microsoft 365: list the groups and their members. */
export const azureGroupsReadMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "azure:groups:read")
    return next()
  })

/** Microsoft 365: add or remove an existing directory user in a group. */
export const azureGroupsWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "azure:groups:write")
    return next()
  })

/** CIE signatures: see and sign the requests that involve the user. */
export const esignReadMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "esign:sign")
    return next()
  })

/** CIE signatures: start or cancel one's own signature, decline a request. */
export const esignSignWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "esign:sign")
    return next()
  })

/** CIE signatures: choose which roles and permissions may use each drive. */
export const esignDrivesManageMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "esign:sign")
    requirePermission(context.permissions, "esign:drives:manage")
    return next()
  })

/** CIE signatures: upload documents, browse the shared drive, create, cancel and redeliver requests. */
export const esignRequestsManageMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(({ next, context }) => {
    requirePermission(context.permissions, "esign:sign")
    requirePermission(context.permissions, "esign:requests:manage")
    return next()
  })
