import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PromotionPage } from "@/features/association-portal/portal-promotions"
import { getPortalCatalogue } from "@/features/association-portal/portal.functions"
import { getPortalPromotion } from "@/features/association-portal/promotion.functions"

export const Route = createFileRoute("/dashboard/associations/promotions/$promotionId")({
  loader: async ({ params }) => {
    const [promotion, catalogue] = await Promise.all([
      getPortalPromotion({ data: { id: params.promotionId } }),
      getPortalCatalogue(),
    ])
    return { promotion, catalogue }
  },
  pendingComponent: () => (
    <>
      <PageBar back={{ label: "Associazioni", link: { to: "/dashboard/associations" } }} />
      <PageContent width="record">
        <RecordSkeleton label="Caricamento richiesta…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  const { promotion, catalogue } = Route.useLoaderData()
  return <PromotionPage key={promotion.id} promotion={promotion} catalogue={catalogue} />
}
