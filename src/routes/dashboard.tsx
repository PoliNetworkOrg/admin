import { createFileRoute, redirect } from "@tanstack/react-router"
import { DashboardFrame } from "@/components/dashboard-frame"
import { getAgentMode, getCurrentSession } from "@/server/api.functions"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const [agentMode, session] = await Promise.all([getAgentMode(), getCurrentSession()])
    if (!agentMode && !session?.user) throw redirect({ to: "/login" })
    if (!session) throw new Error("Agent mode did not provide a preview session")
    return { session }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  return <DashboardFrame initialSession={session} />
}
