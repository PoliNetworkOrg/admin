import { createFileRoute, redirect } from "@tanstack/react-router"

import { getSessionState } from "@/features/auth/auth.functions"
import { LoginPage } from "@/features/auth/login-page"

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { agentMode, session } = await getSessionState()
    if (!agentMode && session) throw redirect({ to: "/dashboard" })
  },
  component: LoginPage,
})
