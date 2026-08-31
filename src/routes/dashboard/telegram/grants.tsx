import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { TelegramGrantsPage } from "@/features/telegram/grants-page"
import { getTelegramGrants } from "@/features/telegram/grants.functions"
import { hasWriteAdminRole } from "@/server/authorization"

export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: () => getTelegramGrants(),
  pendingComponent: () => <DataPageSkeleton columns={6} withTabs />,
  component: TelegramGrantsRoute,
})

function TelegramGrantsRoute() {
  const grants = Route.useLoaderData()
  const { roles } = Route.useRouteContext()
  return <TelegramGrantsPage grants={grants} canWrite={hasWriteAdminRole(roles)} />
}
