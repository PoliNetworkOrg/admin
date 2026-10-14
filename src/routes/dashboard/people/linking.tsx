import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { LinkingPage } from "@/features/people/linking-page"
import { getLinkingReviews, getPendingInvites } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/linking")({
  loader: async () => {
    const [reviews, invites] = await Promise.all([getLinkingReviews(), getPendingInvites()])
    return { reviews, invites }
  },
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
  const { reviews, invites } = Route.useLoaderData()
  return <LinkingPage reviews={reviews} invites={invites} />
}
