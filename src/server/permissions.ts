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
  "azure:members:create",
] as const

export type Permission = (typeof PERMISSIONS)[number]

export function hasPermission(permissions: readonly string[], permission: Permission) {
  return permissions.includes(permission)
}

export function isAgentModeEnabled(nodeEnv: string, agentMode: boolean) {
  return nodeEnv === "development" && agentMode
}
