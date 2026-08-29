import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import { GroupsByLabelPage } from "@/features/groups-by-label/groups-by-label-page"
import { getGroupLabelRelations, getGroupLabels, getTelegramGroups } from "@/features/telegram/groups.functions"
import { getWhatsappGroupLabelRelations, getWhatsappGroups } from "@/features/whatsapp/groups.functions"

export const Route = createFileRoute("/dashboard/web/groups-by-label/$")({
  loader: async () => {
    const [tgGroups, groupLabels, tgGroupLabelRelations, waGroups, waGroupLabelRelations] = await Promise.all([
      getTelegramGroups(),
      getGroupLabels(),
      getGroupLabelRelations(),
      getWhatsappGroups(),
      getWhatsappGroupLabelRelations(),
    ])
    return { tgGroups, groupLabels, tgGroupLabelRelations, waGroups, waGroupLabelRelations }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: GroupsByLabelRoute,
})

function GroupsByLabelRoute() {
  const { _splat } = Route.useParams()
  const { tgGroups, groupLabels, tgGroupLabelRelations, waGroups, waGroupLabelRelations } = Route.useLoaderData()
  const path = urlSegmentsToLabelPath((_splat ?? "").split("/"))

  return (
    <GroupsByLabelPage
      path={path}
      loadedTgGroups={tgGroups}
      loadedGroupLabels={groupLabels}
      loadedTgGroupLabelRelations={tgGroupLabelRelations}
      loadedWaGroups={waGroups}
      loadedWaGroupLabelRelations={waGroupLabelRelations}
    />
  )
}
