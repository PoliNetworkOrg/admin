import { createFileRoute, notFound } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getTeams } from "@/features/people/people-teams.functions"
import { TeamPage } from "@/features/people/teams-page"

export const Route = createFileRoute("/dashboard/people/teams/$teamId")({
  loader: async ({ params }) => {
    const team = (await getTeams()).find((candidate) => candidate.id === params.teamId)
    if (!team) throw notFound()
    return team
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading team…" />
      </PageContent>
    </>
  ),
  component: TeamRoute,
})

function TeamRoute() {
  return <TeamPage team={Route.useLoaderData()} />
}
