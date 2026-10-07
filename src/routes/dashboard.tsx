import { createFileRoute, redirect } from "@tanstack/react-router"

import { RouteError, RouteNotFound } from "@/components/route-error"
import { DashboardShell, documentTitle, matchPath } from "@/components/shell"
import { getDashboardAccess } from "@/features/auth/auth.functions"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw redirect({ to: "/login" })
    if (access.status === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (access.status === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    return { session: access.session, roles: access.roles }
  },
  // Not awaited: the panel count streams in. It is decoration, so a failed load hides it; the Reports page reports
  // the error. `router.invalidate()` (e.g. after resolving a report) refreshes it.
  loader: () => ({
    pendingReports: getPendingGroupLinkReports().then(
      (reports) => reports.length,
      (error) => {
        console.error(error)
        return null
      }
    ),
  }),
  staleTime: 60_000,
  // One title for every dashboard page, from the deepest match: "{Section} · {Service} · PoliNetwork Admin".
  head: ({ matches }) => ({ meta: [{ title: documentTitle(matchPath(matches.at(-1)?.pathname ?? "/dashboard")) }] }),
  // Unknown `/dashboard/…` URLs render in the shell's content column; a failure in this route's own `beforeLoad` or
  // loader has no shell yet, so the same component centres itself on the page.
  notFoundComponent: RouteNotFound,
  errorComponent: RouteError,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  const { pendingReports } = Route.useLoaderData()
  return <DashboardShell initialSession={session} pendingReports={pendingReports} />
}
