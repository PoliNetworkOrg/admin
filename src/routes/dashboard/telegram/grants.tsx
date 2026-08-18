import { createFileRoute } from "@tanstack/react-router"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { getTelegramGrants } from "@/features/telegram/grants.functions"
import { TelegramGrantsPage } from "@/features/telegram/grants-page"

export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: () => getTelegramGrants(),
  pendingComponent: () => <DataPageSkeleton columns={6} withTabs />,
  component: TelegramGrantsRoute,
})

function TelegramGrantsRoute() {
  const grants = Route.useLoaderData()
  return <TelegramGrantsPage grants={grants} />
}
