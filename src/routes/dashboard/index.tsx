import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DashboardOverviewPage } from "@/features/dashboard/overview-page"
import { getOverviewCounts, getTelegramUserHistory } from "@/features/dashboard/overview.functions"

export const Route = createFileRoute("/dashboard/")({
  // Both start at once; the history is not awaited, so the hero renders with the counts and its chart streams in.
  loader: async () => {
    const userHistory = getTelegramUserHistory().catch((error) => {
      console.error(error)
      return { status: "error" as const }
    })
    return { counts: await getOverviewCounts(), userHistory }
  },
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
  const { counts, userHistory } = Route.useLoaderData()
  return <DashboardOverviewPage counts={counts} userHistory={userHistory} />
}
