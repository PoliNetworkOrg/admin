import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import type { AdminSession } from "@/lib/auth"

type DashboardAccess =
  | { status: "unauthenticated"; session: null; roles: string[] }
  | { status: "telegram-unlinked" | "forbidden" | "authorized"; session: AdminSession; roles: string[] }

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
      const { authorizeAdmin } = await import("@/server/auth.server")
      const authorization = await authorizeAdmin(context.session, context.backend)
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
