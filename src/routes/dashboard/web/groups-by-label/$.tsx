import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import {
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
} from "@/features/group-labels/group-labels.functions"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import { GroupsByLabelPage } from "@/features/groups-by-label/groups-by-label-page"

export const Route = createFileRoute("/dashboard/web/groups-by-label/$")({
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      listGroupsForLabels(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { ...groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: GroupsByLabelRoute,
})

function GroupsByLabelRoute() {
  const { _splat } = Route.useParams()
  const { tgGroups, groupLabels, groupsWithLabels, waGroups } = Route.useLoaderData()
  const path = urlSegmentsToLabelPath((_splat ?? "").split("/"))

  return (
    <GroupsByLabelPage
      path={path}
      loadedTgGroups={tgGroups}
      loadedGroupLabels={groupLabels}
      loadedGroupsWithLabels={groupsWithLabels}
      loadedWaGroups={waGroups}
    />
  )
}
