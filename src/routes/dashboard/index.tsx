import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DashboardOverviewPage } from "@/features/dashboard/overview-page"
import { getOverviewCounts } from "@/features/dashboard/overview.functions"

export const Route = createFileRoute("/dashboard/")({
  loader: () => getOverviewCounts(),
  staleTime: 60_000,
  pendingComponent: () => (
    <>
      <PageBar title="Overview" width="overview" />
      <PageContent width="overview">
        <CardsSkeleton label="Loading overview…" />
      </PageContent>
    </>
  ),
  component: OverviewRoute,
})

function OverviewRoute() {
  return <DashboardOverviewPage counts={Route.useLoaderData()} />
}
