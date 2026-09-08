import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { GroupLinkReportsPage } from "@/features/group-link-reports/reports-page"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"

export const Route = createFileRoute("/dashboard/reports/group-links")({
  loader: () => getPendingGroupLinkReports(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: GroupLinkReportsRoute,
})

function GroupLinkReportsRoute() {
  const reports = Route.useLoaderData()
  return <GroupLinkReportsPage loadedReports={reports} />
}
