import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { TelegramUsersPage } from "@/features/telegram/users-page"
import { getTelegramUsers } from "@/features/telegram/users.functions"

export const Route = createFileRoute("/dashboard/telegram/users/")({
  loader: () => getTelegramUsers(),
  pendingComponent: () => (
    <PageContent>
      <TableSkeleton columns={2} label="Loading users…" />
    </PageContent>
  ),
  component: TelegramUsersRoute,
})

function TelegramUsersRoute() {
  return <TelegramUsersPage users={Route.useLoaderData()} />
}
