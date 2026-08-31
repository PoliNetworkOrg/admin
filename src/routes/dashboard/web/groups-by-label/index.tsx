import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { GroupsByLabelPage } from "@/features/groups-by-label/groups-by-label-page"
import { getTelegramGroups } from "@/features/telegram/groups.functions"
import { getWhatsappGroups } from "@/features/whatsapp/groups.functions"

export const Route = createFileRoute("/dashboard/web/groups-by-label/")({
  loader: async () => {
    const [tgGroups, groupLabels, groupsWithLabels, waGroups] = await Promise.all([
      getTelegramGroups(),
      listGroupLabels(),
      listGroupsWithLabels(),
      getWhatsappGroups(),
    ])
    return { tgGroups, groupLabels, groupsWithLabels, waGroups }
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
