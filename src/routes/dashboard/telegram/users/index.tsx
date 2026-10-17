import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { TelegramUsersPage } from "@/features/telegram/users-page"
import { getTelegramUsers } from "@/features/telegram/users.functions"

export const Route = createFileRoute("/dashboard/telegram/users/")({
  validateSearch: z.object({ q: z.string().optional() }),
  loader: () => getTelegramUsers(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={2} label="Loading users…" />
      </PageContent>
    </>
  ),
  component: TelegramUsersRoute,
})

function TelegramUsersRoute() {
  const { q } = Route.useSearch()
  return <TelegramUsersPage users={Route.useLoaderData()} initialQuery={q ?? ""} />
}
