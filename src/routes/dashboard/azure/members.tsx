import { createFileRoute, redirect } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { getAzureMembers } from "@/features/azure/azure.functions"
import { AzureMembersPage } from "@/features/azure/members-page"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/azure/members")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission(context.permissions, "azure:members:read") &&
      !hasPermission(context.permissions, "azure:members:create")
    )
      throw redirect({ to: "/unauthorized" })
  },
  loader: ({ context }) => (hasPermission(context.permissions, "azure:members:read") ? getAzureMembers() : null),
  pendingComponent: () => (
    <PageContent>
      <TableSkeleton columns={4} label="Loading members…" />
    </PageContent>
  ),
  component: AzureMembersRoute,
})

function AzureMembersRoute() {
  return <AzureMembersPage members={Route.useLoaderData()} />
}
