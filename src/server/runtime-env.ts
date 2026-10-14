const DEVELOPMENT_BACKEND_URL = "http://localhost:3000"
const BUILD_BACKEND_URL = "http://build.invalid"

/** A single server-resolved year for every People view; September starts the next academic year. */
export function resolvePeopleYear(configured: string | undefined, now = new Date()) {
  if (configured) return configured
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0)
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`
}

export function resolveBackendUrl(
  backendUrl: string | undefined,
  nodeEnv: string | undefined,
  lifecycle: string | undefined
) {
  if (backendUrl) return backendUrl
  if (nodeEnv === "development") return DEVELOPMENT_BACKEND_URL
  if (lifecycle === "build") return BUILD_BACKEND_URL
  return undefined
}
