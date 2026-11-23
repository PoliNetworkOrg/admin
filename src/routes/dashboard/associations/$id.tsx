import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PortalDetail } from "@/features/association-portal/portal-detail"
import { getPortalAssociation } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/$id")({
  loader: ({ params }) => getPortalAssociation({ data: { id: params.id } }),
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
  const association = Route.useLoaderData()
  return <PortalDetail key={association.id} association={association} />
}
