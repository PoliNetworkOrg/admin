import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import { GroupsByLabelPage } from "@/features/groups-by-label/groups-by-label-page"
import { getTelegramGroups } from "@/features/telegram/groups.functions"
import { getWhatsappGroups } from "@/features/whatsapp/groups.functions"

export const Route = createFileRoute("/dashboard/web/groups-by-label/$")({
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
