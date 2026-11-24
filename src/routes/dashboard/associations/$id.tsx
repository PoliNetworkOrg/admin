import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getPortalCredits } from "@/features/association-portal/credit.functions"
import { getPortalEvents } from "@/features/association-portal/event.functions"
import { PortalDetail } from "@/features/association-portal/portal-detail"
import { getPortalAssociation, getPortalCatalogue } from "@/features/association-portal/portal.functions"
import { getPortalPromotions } from "@/features/association-portal/promotion.functions"

export const Route = createFileRoute("/dashboard/associations/$id")({
  loader: async ({ params }) => {
    const [association, catalogue] = await Promise.all([
      getPortalAssociation({ data: { id: params.id } }),
      getPortalCatalogue(),
    ])
    // Requests are readable by the association's representatives and operators only.
    const team = association.role || association.operator
    const [promotions, events, credits] = team
      ? await Promise.all([
          getPortalPromotions({ data: { id: params.id } }),
          getPortalEvents({ data: { id: params.id } }),
          association.registered ? getPortalCredits({ data: { id: params.id } }) : null,
        ])
      : [[], [], null]
    return { association, catalogue, promotions, events, credits }
  },
  pendingComponent: () => (
    <>
      <PageBar back={{ label: "Associazioni", link: { to: "/dashboard/associations" } }} />
      <PageContent width="record">
        <RecordSkeleton label="Caricamento associazione…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  const { association, catalogue, promotions, events, credits } = Route.useLoaderData()
  return (
    <PortalDetail
      key={association.id}
      association={association}
      catalogue={catalogue}
      promotions={promotions}
      events={events}
      credits={credits}
    />
  )
}
