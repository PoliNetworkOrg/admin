import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { GroupLabelsPage } from "@/features/group-labels/group-labels-page"
import { listGroupLabels } from "@/features/group-labels/group-labels.functions"

export const Route = createFileRoute("/dashboard/web/group-labels")({
  loader: () => listGroupLabels(),
  pendingComponent: () => <DataPageSkeleton columns={3} />,
  component: GroupLabelsRoute,
})

function GroupLabelsRoute() {
  return <GroupLabelsPage loadedGroupLabels={Route.useLoaderData()} />
}
