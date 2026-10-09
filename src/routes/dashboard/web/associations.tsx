import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { AssociationsPage } from "@/features/associations/associations-page"
import { getAssociations } from "@/features/associations/associations.functions"

export const Route = createFileRoute("/dashboard/web/associations")({
  loader: () => getAssociations(),
  pendingComponent: () => (
    <PageContent width="wide">
      <CardsSkeleton label="Loading associations…" />
    </PageContent>
  ),
  component: AssociationsRoute,
})

function AssociationsRoute() {
  return <AssociationsPage loadedAssociations={Route.useLoaderData()} />
}
