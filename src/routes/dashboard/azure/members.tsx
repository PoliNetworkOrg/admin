import { createFileRoute, redirect } from "@tanstack/react-router"

import { AzureMembersPage } from "@/features/azure/members-page"
import { hasPermission } from "@/server/permissions"
export const Route = createFileRoute("/dashboard/azure/members")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "azure:members:create")) throw redirect({ to: "/unauthorized" })
  },
  component: AzureMembersPage,
})
