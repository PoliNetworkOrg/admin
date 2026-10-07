import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { ProjectsPage } from "@/features/projects/projects-page"
import { getProjects } from "@/features/projects/projects.functions"

export const Route = createFileRoute("/dashboard/web/projects")({
  loader: () => getProjects(),
  pendingComponent: () => (
    <PageContent width="wide">
      <CardsSkeleton label="Loading projects…" />
    </PageContent>
  ),
  component: ProjectsRoute,
})

function ProjectsRoute() {
  return <ProjectsPage loadedProjects={Route.useLoaderData()} />
}
