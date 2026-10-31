import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PeopleOverviewPage } from "@/features/people/overview-page"
import { getTeams } from "@/features/people/people-teams.functions"
import { getPeople } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/")({
  // Teams say which roles Auth binds, for Add person's initial roles.
  loader: async () => {
    const [people, teams] = await Promise.all([getPeople(), getTeams()])
    return { people, teams }
  },
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
  const { people, teams } = Route.useLoaderData()
  return <PeopleOverviewPage people={people} teams={teams} />
}
