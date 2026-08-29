import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import { GroupsByLabelPage } from "@/features/telegram/groups-by-label-page"
import { getGroupLabelRelations, getGroupLabels, getTelegramGroups } from "@/features/telegram/groups.functions"

export const Route = createFileRoute("/dashboard/web/groups-by-label/$")({
  loader: async () => {
    const [groups, groupLabels, groupLabelRelations] = await Promise.all([
      getTelegramGroups(),
      getGroupLabels(),
      getGroupLabelRelations(),
    ])
    return { groups, groupLabels, groupLabelRelations }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: GroupsByLabelRoute,
})

function GroupsByLabelRoute() {
  const { _splat } = Route.useParams()
  const { groups, groupLabels, groupLabelRelations } = Route.useLoaderData()
  const path = urlSegmentsToLabelPath((_splat ?? "").split("/"))

  return (
    <GroupsByLabelPage
      path={path}
      loadedGroups={groups}
      loadedGroupLabels={groupLabels}
      loadedGroupLabelRelations={groupLabelRelations}
    />
  )
}
