import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { TelegramGroupsPage } from "@/features/telegram/groups-page"
import { getTelegramGroups } from "@/features/telegram/groups.functions"

export const Route = createFileRoute("/dashboard/telegram/groups")({
  loader: () => getTelegramGroups(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: TelegramGroupsRoute,
})

function TelegramGroupsRoute() {
  const groups = Route.useLoaderData()
  return <TelegramGroupsPage loadedGroups={groups} />
}
