import { createFileRoute } from "@tanstack/react-router"

import { logout } from "@/server/auth.server"

/** POST only, so the Origin check in `src/start.ts` applies and no link or image can sign a user out. */
export const Route = createFileRoute("/auth/logout")({
  server: { handlers: { POST: () => logout() } },
})
