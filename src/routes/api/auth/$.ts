import { createFileRoute } from "@tanstack/react-router"

import { proxyAuthRequest } from "@/server/auth-proxy.server"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyAuthRequest(request),
      POST: ({ request }) => proxyAuthRequest(request),
      PUT: ({ request }) => proxyAuthRequest(request),
      PATCH: ({ request }) => proxyAuthRequest(request),
      DELETE: ({ request }) => proxyAuthRequest(request),
    },
  },
})
