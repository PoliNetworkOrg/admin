import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PortalDetail } from "@/features/association-portal/portal-detail"
import { getPortalAssociation, getPortalCatalogue } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/$id")({
  loader: async ({ params }) => {
    const [association, catalogue] = await Promise.all([
      getPortalAssociation({ data: { id: params.id } }),
      getPortalCatalogue(),
    ])
    return { association, catalogue }
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
  const { association, catalogue } = Route.useLoaderData()
  return <PortalDetail key={association.id} association={association} catalogue={catalogue} />
}
