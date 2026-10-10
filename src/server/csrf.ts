const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * CSRF (RFC v3 §11.2): every state-changing request (POST server functions, sign-out) must carry an `Origin` equal to
 * the dashboard's configured origin, the same rule as the IdP's `api-guard`. The session cookie is also
 * `SameSite=Lax`. `appOrigin` comes from configuration, never from the request's `Host`.
 */
export function isTrustedRequest(method: string, origin: string | null, appOrigin: string) {
  if (SAFE_METHODS.has(method.toUpperCase())) return true
  return origin !== null && origin === appOrigin
}
