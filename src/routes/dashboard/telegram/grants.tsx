import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { TelegramGrantsPage } from "@/features/telegram/grants-page"
import { getTelegramGrantsWithGrantors } from "@/features/telegram/grants.functions"

export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: () => getTelegramGrantsWithGrantors(),
  pendingComponent: () => (
    <PageContent>
      <TableSkeleton columns={6} label="Loading grants…" />
    </PageContent>
  ),
  component: TelegramGrantsRoute,
})

function TelegramGrantsRoute() {
  return <TelegramGrantsPage grants={Route.useLoaderData()} />
}
