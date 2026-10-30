import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { LinkingPage } from "@/features/people/linking-page"
import { getPendingInvites } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/linking")({
  loader: () => getPendingInvites(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={4} label="Loading…" />
      </PageContent>
    </>
  ),
  component: LinkingRoute,
})

function LinkingRoute() {
  return <LinkingPage invites={Route.useLoaderData()} />
}
