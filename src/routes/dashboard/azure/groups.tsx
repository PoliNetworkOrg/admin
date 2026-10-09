import { createFileRoute } from "@tanstack/react-router"

import { SettingsListSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { getAzureDirectory } from "@/features/azure/azure.functions"
import { AzureGroupsPage } from "@/features/azure/groups-page"

export const Route = createFileRoute("/dashboard/azure/groups")({
  loader: () => getAzureDirectory(),
  pendingComponent: AzureGroupsPending,
  component: AzureGroupsRoute,
})

function AzureGroupsPending() {
  return (
    <PageContent>
      <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">
        <SettingsListSkeleton rows={8} label="Loading Microsoft 365 groups…" className="px-5" />
      </div>
    </PageContent>
  )
}

function AzureGroupsRoute() {
  const { groups, members } = Route.useLoaderData()
  return <AzureGroupsPage groups={groups} directoryMembers={members} />
}
