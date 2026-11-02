import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getTeams } from "@/features/people/people-teams.functions"
import { getPeople, getPerson } from "@/features/people/people.functions"
import { PersonPage } from "@/features/people/person-page"

export const Route = createFileRoute("/dashboard/people/$personId")({
  // The other records name who did what (the backend records account IDs); the teams say which roles Auth binds.
  loader: async ({ params }) => {
    const [person, people, teams] = await Promise.all([
      getPerson({ data: { id: params.personId } }),
      getPeople(),
      getTeams(),
    ])
    return { person, people, teams }
  },
  pendingComponent: PersonPending,
  component: PersonRoute,
})

function PersonPending() {
  return (
    <>
      <PageBar width="record" back={{ label: "people", link: { to: "/dashboard/people" } }} crumb="People" />
      <PageContent width="record">
        <RecordSkeleton label="Loading person…" />
      </PageContent>
    </>
  )
}

function PersonRoute() {
  const { person, people, teams } = Route.useLoaderData()
  return <PersonPage person={person} people={people} teams={teams} />
}
