import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PeopleOverviewPage } from "@/features/people/overview-page"
import { getPeople } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/")({
  loader: () => getPeople(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={6} label="Loading people…" />
      </PageContent>
    </>
  ),
  component: PeopleOverviewRoute,
})

function PeopleOverviewRoute() {
  return <PeopleOverviewPage people={Route.useLoaderData()} />
}
