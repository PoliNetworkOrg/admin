const DEVELOPMENT_BACKEND_URL = "http://localhost:3000"
const BUILD_BACKEND_URL = "http://build.invalid"

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
