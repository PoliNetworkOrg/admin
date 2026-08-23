export const ADMIN_ROLES = ["owner", "direttivo", "president", "hr"] as const
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
