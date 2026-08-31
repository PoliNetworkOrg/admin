import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"

import type { AdminSession } from "@/lib/auth"
type DashboardAccess =
  | { status: "unauthenticated"; session: null; roles: string[] }
  | {
      status: "telegram-unlinked" | "forbidden" | "authorized"
      session: AdminSession
      roles: string[]
    }

export const backendMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { createRequestBackend } = await import("@/server/auth.server")
  return next({ context: { backend: createRequestBackend() } })
})

export const sessionMiddleware = createMiddleware({ type: "function" })
  .middleware([backendMiddleware])
  .server(async ({ next }) => {
    const [{ isAgentMode, readRequestSession }, { setResponseHeader }] = await Promise.all([
      import("@/server/auth.server"),
      import("@tanstack/react-start/server"),
    ])
    setResponseHeader("Cache-Control", "private, no-store")
    setResponseHeader("Vary", "Cookie")
    return next({ context: { session: await readRequestSession(), agentMode: isAgentMode() } })
  })

export const dashboardAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    let dashboardAccess: DashboardAccess
    if (!context.session) {
      dashboardAccess = { status: "unauthenticated", session: null, roles: [] }
    } else {
      const { authorizeWebAdmin } = await import("@/server/auth.server")
      const authorization = await authorizeWebAdmin(context.session, context.backend)
      if (authorization === "telegram-unlinked") {
        dashboardAccess = { status: "telegram-unlinked", session: context.session, roles: [] }
      } else if (authorization === "forbidden") {
        dashboardAccess = { status: "forbidden", session: context.session, roles: [] }
      } else {
        dashboardAccess = {
          status: "authorized",
          session: authorization.session,
          roles: authorization.roles,
        }
      }
    }

    return next({ context: { dashboardAccess } })
  })

export const authenticatedMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(({ next, context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    return next({ context: { session: context.session } })
  })

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authenticatedMiddleware])
  .server(async ({ next, context }) => {
    const { authorizeAdmin } = await import("@/server/auth.server")
    const authorization = await authorizeAdmin(context.session, context.backend)
    if (authorization === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (authorization === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    return next({ context: authorization })
  })

/** Authorization for reads and writes that are exclusively exposed under /dashboard/web. */
export const webAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([authenticatedMiddleware])
  .server(async ({ next, context }) => {
    const { authorizeWebAdmin } = await import("@/server/auth.server")
    const authorization = await authorizeWebAdmin(context.session, context.backend)
    if (authorization === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (authorization === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    return next({ context: authorization })
  })

export const writeAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(async ({ next, context }) => {
    const { hasWriteAdminRole } = await import("@/server/authorization")
    if (!hasWriteAdminRole(context.roles)) throw new Error("UNAUTHORIZED")
    return next()
  })

/** Group management is writable by full write administrators and the dedicated web role. */
export const groupWriteAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([adminMiddleware])
  .server(async ({ next, context }) => {
    const { hasGroupWriteRole } = await import("@/server/authorization")
    if (!hasGroupWriteRole(context.roles)) throw new Error("UNAUTHORIZED")
    return next()
  })

/** For mutations scoped to the /dashboard/web section: full write roles, plus the "web" role. */
export const webWriteAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([webAdminMiddleware])
  .server(async ({ next, context }) => {
    const { hasWebWriteRole } = await import("@/server/authorization")
    if (!hasWebWriteRole(context.roles)) throw new Error("UNAUTHORIZED")
    return next()
  })
