import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { getAzureMembers } from "@/features/azure/azure.functions"
import { AzureMembersPage } from "@/features/azure/members-page"

export const Route = createFileRoute("/dashboard/azure/members")({
  loader: () => getAzureMembers(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: AzureMembersRoute,
})

function AzureMembersRoute() {
  const members = Route.useLoaderData()
  return <AzureMembersPage initialMembers={members} />
}
