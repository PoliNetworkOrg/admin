/**
 * The IdP permissions the dashboard reads from `me.access` (RFC v3 §4.1, §8). They only decide what the UI shows and
 * which server functions run; the backend checks every call again.
 */
export const PERMISSIONS = [
  "admin:access",
  "tg:users:read",
  "tg:messages:read",
  "tg:audit:read",
  "tg:groups:manage",
  "tg:grants:read",
  "tg:grants:manage",
  "wa:groups:manage",
  "groups:labels:write",
  "web:content:write",
  "web:reports:manage",
  "azure:members:read",
  "azure:members:create",
  "azure:members:write",
  "azure:groups:read",
  "people:self",
  "people:read",
  "people:write",
  "people:appoint",
  "esign:sign",
  "esign:requests:manage",
  "esign:drives:manage",
] as const

export type Permission = (typeof PERMISSIONS)[number]

export function hasPermission(permissions: readonly string[], permission: Permission) {
  return permissions.includes(permission)
}

/**
 * Whether these permissions open the dashboard: `admin:access` for the full dashboard, or `people:self` alone for the
 * restricted view (My area, plus Capo Admin or a team page when the person's record gives them that role).
 */
export function canEnterDashboard(permissions: readonly string[]) {
  return hasPermission(permissions, "admin:access") || hasPermission(permissions, "people:self")
}

/**
 * Agent mode's permissions: every one, or the comma-separated `AGENT_PERMISSIONS` (development only) to preview a
 * restricted role. Unknown names are dropped.
 */
export function agentPermissions(list: string | undefined): Permission[] {
  if (!list) return [...PERMISSIONS]
  const requested = list.split(",").map((permission) => permission.trim())
  return PERMISSIONS.filter((permission) => requested.includes(permission))
}

export function isAgentModeEnabled(nodeEnv: string, agentMode: boolean) {
  return nodeEnv === "development" && agentMode
}
