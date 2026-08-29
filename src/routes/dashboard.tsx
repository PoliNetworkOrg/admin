import { createFileRoute, redirect } from "@tanstack/react-router"

import { DashboardFrame } from "@/components/dashboard-frame"
import { RouteError } from "@/components/route-error"
import { getDashboardAccess } from "@/features/auth/auth.functions"
import { listGroupLabels } from "@/features/group-labels/group-labels.functions"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw redirect({ to: "/login" })
    if (access.status === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (access.status === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    return { session: access.session, roles: access.roles }
  },
  loader: () => listGroupLabels(),
  errorComponent: RouteError,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  const groupLabels = Route.useLoaderData()
  return <DashboardFrame initialSession={session} groupLabels={groupLabels} />
}
