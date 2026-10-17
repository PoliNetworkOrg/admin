import { createFileRoute } from "@tanstack/react-router"

import { startLogin } from "@/server/auth.server"

export const Route = createFileRoute("/auth/login")({
  server: { handlers: { GET: ({ request }) => startLogin(request) } },
})
