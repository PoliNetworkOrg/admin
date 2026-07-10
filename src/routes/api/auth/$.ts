import { AUTH_PATH } from "@polinetwork/backend"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: proxyAuth,
      POST: proxyAuth,
      PUT: proxyAuth,
      PATCH: proxyAuth,
      DELETE: proxyAuth,
    },
  },
})

async function proxyAuth({ request }: { request: Request }) {
  const incomingUrl = new URL(request.url)
  const backendOrigin = process.env.BACKEND_URL ?? "http://localhost:3000"
  const backendUrl = new URL(
    `${AUTH_PATH}${incomingUrl.pathname.slice(AUTH_PATH.length)}${incomingUrl.search}`,
    backendOrigin
  )

  return fetch(new Request(backendUrl, request))
}
