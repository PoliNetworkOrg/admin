import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { CensusPage } from "@/features/people/census-page"
import { getCampaigns } from "@/features/people/people-census.functions"

export const Route = createFileRoute("/dashboard/people/census/")({
  loader: () => getCampaigns(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={6} label="Loading campaigns…" />
      </PageContent>
    </>
  ),
  component: CensusRoute,
})

function CensusRoute() {
  return <CensusPage campaigns={Route.useLoaderData()} />
}
