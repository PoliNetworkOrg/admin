import { createFileRoute, redirect } from "@tanstack/react-router"

import { DashboardFrame } from "@/components/dashboard-frame"
import { RouteError } from "@/components/route-error"
import { getDashboardAccess } from "@/features/auth/auth.functions"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw redirect({ to: "/login" })
    if (access.status === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (access.status === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    if (access.status === "web-authorized" && !location.pathname.startsWith("/dashboard/web")) {
      throw redirect({ to: "/onboarding/unauthorized" })
    }
    return { session: access.session, roles: access.roles }
  },
  errorComponent: RouteError,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  return <DashboardFrame initialSession={session} />
}
