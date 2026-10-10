import { createServerFn } from "@tanstack/react-start"

import { dashboardAccessMiddleware, sessionMiddleware } from "@/server/auth.middleware"

/** Whether a session exists. Never returns the session itself: it holds the tokens. */
export const getSessionState = createServerFn()
  .middleware([sessionMiddleware])
  .handler(({ context }) => ({ signedIn: context.session !== null, agentMode: context.agentMode }))

export const getDashboardAccess = createServerFn()
  .middleware([dashboardAccessMiddleware])
  .handler(({ context }) => context.dashboardAccess)

/** The IdP's account page: Telegram linking, passkeys and sessions live there now (RFC v3 §11.4). */
export const getIdpAccountUrl = createServerFn().handler(async () => {
  const { authConfig, isAgentMode } = await import("@/server/auth.server")
  return isAgentMode() ? "https://auth.polinetwork.org/" : authConfig().accountUrl
})
