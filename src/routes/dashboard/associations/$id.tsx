import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
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
    const promotions =
      association.role || association.operator ? await getPortalPromotions({ data: { id: params.id } }) : []
    return { association, catalogue, promotions }
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
  const { association, catalogue, promotions } = Route.useLoaderData()
  return <PortalDetail key={association.id} association={association} catalogue={catalogue} promotions={promotions} />
}
