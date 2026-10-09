import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { ReportsPage } from "@/features/group-link-reports/reports-page"
import { getResolvedGroupLinkReports } from "@/features/group-link-reports/reports.functions"

export const Route = createFileRoute("/dashboard/reports/resolved")({
  loader: () => getResolvedGroupLinkReports(),
  pendingComponent: () => (
    <PageContent>
      <TableSkeleton columns={5} label="Loading closed reports…" />
    </PageContent>
  ),
  component: ClosedReportsRoute,
})

function ClosedReportsRoute() {
  return <ReportsPage status="closed" reports={Route.useLoaderData()} />
}
