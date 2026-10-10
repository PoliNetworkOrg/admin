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

/** Reads: the user holds `admin:access`. The backend checks the permission of every procedure on top. */
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authenticatedMiddleware])
  .server(async ({ next, context }) => {
    const { loadAccess } = await import("@/server/auth.server")
    const access = await loadAccess(context.session, context.backend)
    if (access.status !== "authorized") throw redirect({ to: "/unauthorized" })
    return next({ context: { user: access.user, permissions: access.permissions } })
  })

function requirePermission(permissions: readonly string[], permission: Permission) {
  if (!hasPermission(permissions, permission)) throw new Error("UNAUTHORIZED")
}

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
