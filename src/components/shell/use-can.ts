import { getRouteApi } from "@tanstack/react-router"

import { hasPermission, type Permission } from "@/server/permissions"

import { type DashboardPath, NO_PEOPLE_ROLES, sectionVisible, services } from "./nav"

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

/** The logo's destination and its accessible name. */
export type Home = { path: DashboardPath; label: string }

/**
 * Where the logo leads: Overview with `admin:access`, My area with `people:self`, otherwise the first service the user
 * can open (Regolamenti for someone admitted only by a draft assignment or a delega).
 */
export function useHome(): Home {
  const permissions = dashboardRoute.useRouteContext({ select: (context) => context.permissions })
  const visible = useVisibleServices()
  if (hasPermission(permissions, "admin:access")) return { path: "/dashboard", label: "Overview" }
  if (hasPermission(permissions, "people:self")) return { path: "/dashboard/account/me", label: "My area" }
  const first = visible.find((service) => service.id !== "account" && service.id !== "overview")
  return first ? { path: first.path, label: first.title } : { path: "/dashboard/account", label: "Account" }
}
