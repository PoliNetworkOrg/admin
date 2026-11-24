import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PromotionQueue } from "@/features/association-portal/portal-promotions"
import { getPortalPromotionQueue } from "@/features/association-portal/portal-review.functions"
import { promotionQueueSchema } from "@/features/association-portal/portal.contract"

export const Route = createFileRoute("/dashboard/associations/promotions/")({
  // By default the queue opens on what waits for a decision.
  validateSearch: (search) => {
    const parsed = promotionQueueSchema.safeParse(search)
    return parsed.success ? parsed.data : {}
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => ({
    filter: deps,
    promotions: await getPortalPromotionQueue({ data: deps }),
  }),
  pendingComponent: () => (
    <>
      <PageBar width="wide" />
      <PageContent width="wide">
        <TableSkeleton columns={4} label="Caricamento richieste…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  const { filter, promotions } = Route.useLoaderData()
  return <PromotionQueue promotions={promotions} filter={filter} />
}
