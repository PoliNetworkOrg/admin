import { getRouteApi } from "@tanstack/react-router"

import { hasPermission, type Permission } from "@/server/permissions"

import { services } from "./nav"

const dashboardRoute = getRouteApi("/dashboard")

/**
 * Whether the signed-in admin holds `permission`, from the `me.access` permissions `/dashboard` puts in the route
 * context. Hide controls the backend would reject; the backend still enforces every call.
 */
export function useCan(permission: Permission) {
  const permissions = dashboardRoute.useRouteContext({ select: (context) => context.permissions })
  return hasPermission(permissions, permission)
}

/** The sections available to the user, including read-specific and dedicated member permissions. */
export function useVisibleServices() {
  const permissions = dashboardRoute.useRouteContext({ select: (context) => context.permissions })
  return services.flatMap((service) => {
    if (service.sections.length === 0) return [service]
    const sections = service.sections.filter(
      (section) => !section.permission || hasPermission(permissions, section.permission)
    )
    return sections.length ? [{ ...service, sections, path: sections[0].path }] : []
  })
}
