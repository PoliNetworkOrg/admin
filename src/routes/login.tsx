import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { getSessionState } from "@/features/auth/auth.functions"
import { LoginPage } from "@/features/auth/login-page"

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ error: z.string().optional() }),
  beforeLoad: async () => {
    const { agentMode, signedIn } = await getSessionState()
    if (!agentMode && signedIn) throw redirect({ to: "/dashboard" })
  },
  component: LoginRoute,
})

function LoginRoute() {
  const { error } = Route.useSearch()
  return <LoginPage error={error} />
}
