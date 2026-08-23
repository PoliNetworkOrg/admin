import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { AssociationsPage } from "@/features/associations/associations-page"
import { getAssociations } from "@/features/associations/associations.functions"

export const Route = createFileRoute("/dashboard/web/associations")({
  loader: () => getAssociations(),
  pendingComponent: () => <DataPageSkeleton columns={2} />,
  component: AssociationsRoute,
})

function AssociationsRoute() {
  return <AssociationsPage loadedAssociations={Route.useLoaderData()} />
}
