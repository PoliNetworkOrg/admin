import { createMiddleware, createStart } from "@tanstack/react-start"

/**
 * CSRF for every state-changing request, server functions and the sign-out route alike: the `Origin` must be the
 * dashboard's configured origin (RFC v3 §11.2). It replaces TanStack Start's default CSRF middleware, which compares
 * against the request URL instead of the configured origin.
 */
const originCheckMiddleware = createMiddleware().server(async ({ request, next }) => {
  const [{ resolveAppOrigin }, { isTrustedRequest }] = await Promise.all([
    import("@/server/auth-config"),
    import("@/server/csrf"),
  ])
  const appOrigin = resolveAppOrigin(process.env, process.env.NODE_ENV)
  if (!isTrustedRequest(request.method, request.headers.get("origin"), appOrigin)) {
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } })
  }
  // The router renders thrown loader errors with status 500. Check session availability before it starts so Redis
  // or an expired-token IdP outage produces the required HTTP 503 for SSR and server-function requests alike.
  const cookie = request.headers.get("cookie") ?? ""
  if (
    !new URL(request.url).pathname.startsWith("/auth/") &&
    new URL(request.url).pathname !== "/login" &&
    /(?:^|;\s*)(?:__Host-)?pn-admin-session=/.test(cookie)
  ) {
    const { readRequestSession } = await import("@/server/auth.server")
    try {
      await readRequestSession()
    } catch (error) {
      console.error(error)
      return new Response("The sign-in service is temporarily unavailable. Try again shortly.", {
        status: 503,
        headers: { "cache-control": "private, no-store", vary: "Cookie" },
      })
    }
  }
  return next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [originCheckMiddleware] }))
