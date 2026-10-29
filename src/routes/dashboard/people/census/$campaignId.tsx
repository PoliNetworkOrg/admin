import { createFileRoute, notFound } from "@tanstack/react-router"

import { CampaignPage } from "@/features/people/census-page"
import { mockCampaign } from "@/features/people/mockup-data"

// An unconnected mockup (Phase 3, #145): the campaign comes from the static sample data, not the backend.
export const Route = createFileRoute("/dashboard/people/census/$campaignId")({
  loader: ({ params }) => {
    const detail = mockCampaign(params.campaignId)
    if (!detail) throw notFound()
    return detail
  },
  component: CampaignRoute,
})

function CampaignRoute() {
  return <CampaignPage detail={Route.useLoaderData()} />
}
