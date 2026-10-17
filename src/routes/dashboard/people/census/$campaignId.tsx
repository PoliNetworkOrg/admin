import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { CampaignPage } from "@/features/people/census-page"
import { getCampaign } from "@/features/people/people-census.functions"

export const Route = createFileRoute("/dashboard/people/census/$campaignId")({
  loader: ({ params }) => getCampaign({ data: { id: params.campaignId } }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading campaign…" />
      </PageContent>
    </>
  ),
  component: CampaignRoute,
})

function CampaignRoute() {
  return <CampaignPage detail={Route.useLoaderData()} />
}
