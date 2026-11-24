import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PortalCatalogue } from "@/features/association-portal/portal-catalogue"
import { getPortalCatalogue } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/catalogue")({
  loader: () => getPortalCatalogue(),
  pendingComponent: () => (
    <>
      <PageBar width="wide" />
      <PageContent width="wide">
        <TableSkeleton columns={3} label="Caricamento corsi e sedi…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  return <PortalCatalogue catalogue={Route.useLoaderData()} />
}
