import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getTeams } from "@/features/people/people-teams.functions"
import { TeamsSection } from "@/features/people/teams-page"

export const Route = createFileRoute("/dashboard/people/teams/")({
  loader: () => getTeams(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <CardsSkeleton label="Loading teams…" />
      </PageContent>
    </>
  ),
  component: TeamsRoute,
})

function TeamsRoute() {
  return <TeamsSection teams={Route.useLoaderData()} />
}
