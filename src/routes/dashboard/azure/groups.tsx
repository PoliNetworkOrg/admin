import { createFileRoute } from "@tanstack/react-router"

import { getAzureDirectory } from "@/features/azure/azure.functions"
import { AzureGroupsPage, AzureGroupsSkeleton } from "@/features/azure/groups-page"

export const Route = createFileRoute("/dashboard/azure/groups")({
  loader: () => getAzureDirectory(),
  head: () => ({ meta: [{ title: "Microsoft 365 Groups | PoliNetwork Admin" }] }),
  pendingComponent: AzureGroupsSkeleton,
  component: AzureGroupsRoute,
})

function AzureGroupsRoute() {
  const { groups, members } = Route.useLoaderData()
  return <AzureGroupsPage groups={groups} directoryMembers={members} />
}
