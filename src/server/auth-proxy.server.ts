import { AUTH_PATH } from "@polinetwork/backend"
import { env } from "@/env"
import { getAgentSession, isAgentMode } from "@/server/auth.server"
import { forwardAuthRequest } from "@/server/auth-proxy-core"

export function proxyAuthRequest(request: Request) {
  const incomingUrl = new URL(request.url)
  if (isAgentMode() && incomingUrl.pathname === `${AUTH_PATH}/get-session`) {
    return Response.json(getAgentSession())
  }

  return forwardAuthRequest(request, env.BACKEND_URL, AUTH_PATH)
}
