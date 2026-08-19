export const ADMIN_ROLES = ["owner", "direttivo", "president"] as const

export function isAgentModeEnabled(nodeEnv: string, agentMode: boolean) {
  return nodeEnv === "development" && agentMode
}

export function hasAdminRole(roles: readonly string[]) {
  if (roles.includes("creator")) return false
  return roles.some((role) => ADMIN_ROLES.some((adminRole) => adminRole === role))
}
