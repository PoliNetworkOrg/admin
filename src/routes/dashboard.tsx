import { createFileRoute, redirect } from "@tanstack/react-router"
import { DashboardFrame } from "@/components/dashboard-frame"
import { DashboardPageSkeleton } from "@/components/loading-skeleton"
import { getCurrentSession } from "@/server/api.functions"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getCurrentSession()
    if (!session?.user) throw redirect({ to: "/login" })
    return { session }
  },
  pendingComponent: DashboardPageSkeleton,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  return <DashboardFrame initialSession={session} />
}
