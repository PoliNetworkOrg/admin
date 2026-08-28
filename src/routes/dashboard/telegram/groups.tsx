import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { TelegramGroupsPage } from "@/features/telegram/groups-page"
import { getGroupLabelRelations, getGroupLabels, getTelegramGroups } from "@/features/telegram/groups.functions"

export const Route = createFileRoute("/dashboard/telegram/groups")({
  loader: async () => {
    const [groups, groupLabels, groupLabelRelations] = await Promise.all([
      getTelegramGroups(),
      getGroupLabels(),
      getGroupLabelRelations(),
    ])
    return { groups, groupLabels, groupLabelRelations }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: TelegramGroupsRoute,
})

function TelegramGroupsRoute() {
  const { groups, groupLabels, groupLabelRelations } = Route.useLoaderData()
  return (
    <TelegramGroupsPage
      loadedGroups={groups}
      loadedGroupLabels={groupLabels}
      loadedGroupLabelRelations={groupLabelRelations}
    />
  )
}
