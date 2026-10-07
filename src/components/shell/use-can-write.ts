import { getRouteApi } from "@tanstack/react-router"

import { hasWebWriteRole, hasWriteAdminRole } from "@/server/authorization"

const dashboardRoute = getRouteApi("/dashboard")

export type WriteScope = "web"

/** The server's rule (`src/server/authorization.ts`): write roles, plus the "web" role for `"web"`-scoped mutations. */
export function canWrite(roles: readonly string[], scope?: WriteScope) {
  return scope === "web" ? hasWebWriteRole(roles) : hasWriteAdminRole(roles)
}

/**
 * Whether the signed-in admin may mutate, from the roles `/dashboard` puts in the route context. Pass `"web"` on
 * Web pages and on Telegram/WhatsApp group pages, where the web role may also write.
 */
export function useCanWrite(scope?: WriteScope) {
  const roles = dashboardRoute.useRouteContext({ select: (context) => context.roles })
  return canWrite(roles, scope)
}
