import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { TelegramUsersPage } from "@/features/telegram/users-page"
import { getTelegramUsers } from "@/features/telegram/users.functions"

export const Route = createFileRoute("/dashboard/telegram/users/")({
  loader: () => getTelegramUsers(),
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: TelegramUsersRoute,
})

function TelegramUsersRoute() {
  return <TelegramUsersPage users={Route.useLoaderData()} />
}
