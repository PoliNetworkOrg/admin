import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { getAzureMembers } from "@/features/azure/azure.functions"
import { AzureMembersPage } from "@/features/azure/members-page"

export const Route = createFileRoute("/dashboard/azure/members")({
  loader: () => getAzureMembers(),
  pendingComponent: () => (
    <PageContent>
      <TableSkeleton columns={5} label="Loading members…" />
    </PageContent>
  ),
  component: AzureMembersRoute,
})

function AzureMembersRoute() {
  return <AzureMembersPage members={Route.useLoaderData()} />
}
