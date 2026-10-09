import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { GroupLabelsPage } from "@/features/group-labels/group-labels-page"
import { listGroupLabels } from "@/features/group-labels/group-labels.functions"

export const Route = createFileRoute("/dashboard/web/group-labels")({
  loader: () => listGroupLabels(),
  pendingComponent: GroupLabelsPending,
  component: GroupLabelsRoute,
})

function GroupLabelsPending() {
  return (
    <PageContent width="tree">
      <TableSkeleton columns={2} rows={10} label="Loading labels…" />
    </PageContent>
  )
}

function GroupLabelsRoute() {
  return <GroupLabelsPage labels={Route.useLoaderData()} />
}
