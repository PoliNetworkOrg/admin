import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { GroupLinkReportsPage } from "@/features/group-link-reports/reports-page"
import { getResolvedGroupLinkReports } from "@/features/group-link-reports/reports.functions"

export const Route = createFileRoute("/dashboard/reports/resolved")({
  loader: () => getResolvedGroupLinkReports(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: ResolvedGroupLinkReportsRoute,
})

function ResolvedGroupLinkReportsRoute() {
  const reports = Route.useLoaderData()
  return <GroupLinkReportsPage loadedReports={reports} showActions={false} />
}
