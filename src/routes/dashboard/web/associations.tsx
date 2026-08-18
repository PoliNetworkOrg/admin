import { createFileRoute } from "@tanstack/react-router"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { getAssociations } from "@/features/associations/associations.functions"
import { AssociationsPage } from "@/features/associations/associations-page"

export const Route = createFileRoute("/dashboard/web/associations")({
  loader: () => getAssociations(),
  pendingComponent: () => <DataPageSkeleton columns={2} />,
  component: AssociationsRoute,
})

function AssociationsRoute() {
  return <AssociationsPage loadedAssociations={Route.useLoaderData()} />
}
