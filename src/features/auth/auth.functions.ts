import { createServerFn } from "@tanstack/react-start"
import { backendMiddleware, dashboardAccessMiddleware, sessionMiddleware } from "@/server/auth.middleware"

export const getSessionState = createServerFn()
  .middleware([sessionMiddleware])
  .handler(({ context }) => ({ session: context.session, agentMode: context.agentMode }))

export const getDashboardAccess = createServerFn()
  .middleware([dashboardAccessMiddleware])
  .handler(({ context }) => context.dashboardAccess)

export const testBackend = createServerFn()
  .middleware([backendMiddleware])
  .handler(async ({ context }) => {
    try {
      await context.backend.test.dbQuery.query({ dbName: "web" })
      return true
    } catch {
      return false
    }
  })
