import { getRouteApi } from "@tanstack/react-router"

import { hasPermission, type Permission } from "@/server/permissions"

import { NO_PEOPLE_ROLES, sectionVisible, services } from "./nav"

const dashboardRoute = getRouteApi("/dashboard")

/**
 * Whether the signed-in admin holds `permission`, from the `me.access` permissions `/dashboard` puts in the route
 * context. Hide controls the backend would reject; the backend still enforces every call.
 */
export function useCan(permission: Permission) {
  const permissions = dashboardRoute.useRouteContext({ select: (context) => context.permissions })
  return hasPermission(permissions, permission)
}

/** Whether the user has the full dashboard (`admin:access`), not only the restricted People view. */
export function useHasAdminAccess() {
  return dashboardRoute.useRouteContext({ select: (context) => hasPermission(context.permissions, "admin:access") })
}

/** The Capo Admin scope and led teams the signed-in person's record gives them. */
export function usePeopleRoles() {
  return dashboardRoute.useRouteContext({ select: (context) => context.peopleRoles ?? NO_PEOPLE_ROLES })
}

/** The same academic year in filters, fee labels and census summaries, resolved once by the server. */
export function usePeopleYear() {
  return dashboardRoute.useRouteContext({ select: (context) => context.peopleYear })
}

/**
 * The sections available to the user: permissions, `admin:access` for everything but Account, and the roles from
 * their People record (Capo Admin, Team Lead).
 */
export function useVisibleServices() {
  const permissions = dashboardRoute.useRouteContext({ select: (context) => context.permissions })
  const roles = usePeopleRoles()
  return services.flatMap((service) => {
    if (service.sections.length === 0) return hasPermission(permissions, "admin:access") ? [service] : []
    const sections = service.sections.filter((section) => sectionVisible(section, permissions, roles))
    return sections.length ? [{ ...service, sections, path: sections[0].path }] : []
  })
}
