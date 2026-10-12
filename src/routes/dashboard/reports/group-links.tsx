import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { ReportsPage } from "@/features/group-link-reports/reports-page"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"

export const Route = createFileRoute("/dashboard/reports/group-links")({
  loader: () => getPendingGroupLinkReports(),
  pendingComponent: () => (
    <>
      <PageBar title="Open reports" />
      <PageContent>
        <TableSkeleton columns={5} label="Loading open reports…" />
      </PageContent>
    </>
  ),
  component: OpenReportsRoute,
})

function OpenReportsRoute() {
  return <ReportsPage status="open" reports={Route.useLoaderData()} />
}
