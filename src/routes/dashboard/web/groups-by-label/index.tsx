import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import {
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
} from "@/features/group-labels/group-labels.functions"
import { GroupsByLabelPage } from "@/features/groups-by-label/groups-by-label-page"

export const Route = createFileRoute("/dashboard/web/groups-by-label/")({
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      listGroupsForLabels(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { ...groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: GroupsByLabelRoot,
})

/** The top of the category tree — picks Didattica or Extra to drill into, no exact-match groups of its own. */
function GroupsByLabelRoot() {
  const { tgGroups, groupLabels, groupsWithLabels, waGroups } = Route.useLoaderData()

  return (
    <GroupsByLabelPage
      path=""
      loadedTgGroups={tgGroups}
      loadedGroupLabels={groupLabels}
      loadedGroupsWithLabels={groupsWithLabels}
      loadedWaGroups={waGroups}
    />
  )
}
