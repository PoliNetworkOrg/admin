import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { LinkingPage } from "@/features/people/linking-page"
import { getPendingInvites, getPeople, getRecentLinks } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/linking")({
  loader: async () => {
    const [people, invites, recent] = await Promise.all([getPeople(), getPendingInvites(), getRecentLinks()])
    return { people, invites, recent }
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
  const { people, invites, recent } = Route.useLoaderData()
  return <LinkingPage people={people} invites={invites} recent={recent} />
}
