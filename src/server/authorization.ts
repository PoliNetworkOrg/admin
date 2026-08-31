export const ADMIN_ROLES = ["owner", "direttivo", "president", "hr", "web"] as const
export const WRITE_ADMIN_ROLES = ["owner", "direttivo", "president"] as const

export function isAgentModeEnabled(nodeEnv: string, agentMode: boolean) {
  return nodeEnv === "development" && agentMode
}

export function hasAdminRole(roles: readonly string[]) {
  if (roles.includes("creator")) return false
  return roles.some((role) => ADMIN_ROLES.some((adminRole) => adminRole === role))
}

export function hasWriteAdminRole(roles: readonly string[]) {
  if (roles.includes("creator")) return false
  return roles.some((role) => WRITE_ADMIN_ROLES.some((adminRole) => adminRole === role))
}

/** Roles that may access the web-content section. All dashboard readers currently qualify. */
export function hasWebAdminRole(roles: readonly string[]) {
  return hasAdminRole(roles)
}

/** Full write roles, plus "web" — but only for mutations scoped to the /dashboard/web section. */
export function hasWebWriteRole(roles: readonly string[]) {
  if (roles.includes("creator")) return false
  return hasWriteAdminRole(roles) || roles.includes("web")
}

/** Group operations are editable by full write administrators and the dedicated web role. */
export function hasGroupWriteRole(roles: readonly string[]) {
  if (roles.includes("creator")) return false
  return hasWriteAdminRole(roles) || roles.includes("web")
}
