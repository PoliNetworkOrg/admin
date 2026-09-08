import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { TelegramGroupsPage } from "@/features/telegram/groups-page"
import { getTelegramGroups } from "@/features/telegram/groups.functions"

export const Route = createFileRoute("/dashboard/telegram/groups")({
  validateSearch: z.object({ q: z.string().optional() }),
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      getTelegramGroups(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: TelegramGroupsRoute,
})

function TelegramGroupsRoute() {
  const { groups, groupLabels, groupsWithLabels } = Route.useLoaderData()
  const { q } = Route.useSearch()
  return (
    <TelegramGroupsPage
      loadedGroups={groups}
      loadedGroupLabels={groupLabels}
      loadedGroupsWithLabels={groupsWithLabels}
      initialQuery={q}
    />
  )
}
