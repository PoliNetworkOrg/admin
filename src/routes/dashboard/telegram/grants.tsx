import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { TelegramGrantsPage } from "@/features/telegram/grants-page"
import { getTelegramGrants } from "@/features/telegram/grants.functions"

export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: () => getTelegramGrants(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading grants…" />
      </PageContent>
    </>
  ),
  component: TelegramGrantsRoute,
})

function TelegramGrantsRoute() {
  return <TelegramGrantsPage grants={Route.useLoaderData()} />
}
