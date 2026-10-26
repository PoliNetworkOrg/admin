import { createFileRoute, redirect } from "@tanstack/react-router"

import { SettingsListSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getAzureMembers } from "@/features/azure/azure.functions"
import { AzureGroupsPage } from "@/features/azure/groups-page"
import { getAzureGroups } from "@/features/azure/groups.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/azure/groups")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "azure:groups:read")) throw redirect({ to: "/unauthorized" })
  },
  // The directory only adds member emails, so it loads only for those who may read it.
  loader: async ({ context }) => {
    const [groups, members] = await Promise.all([
      getAzureGroups(),
      hasPermission(context.permissions, "azure:members:read") ? getAzureMembers() : null,
    ])
    return { groups, members }
  },
  pendingComponent: AzureGroupsPending,
  component: AzureGroupsRoute,
})

function AzureGroupsPending() {
  return (
    <>
      <PageBar />
      <PageContent>
        <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">
          <SettingsListSkeleton rows={8} label="Loading Microsoft 365 groups…" className="px-5" />
        </div>
      </PageContent>
    </>
  )
}

function AzureGroupsRoute() {
  const { groups, members } = Route.useLoaderData()
  return <AzureGroupsPage groups={groups} directoryMembers={members} />
}
