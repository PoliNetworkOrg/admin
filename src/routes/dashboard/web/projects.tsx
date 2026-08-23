import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { ProjectsPage } from "@/features/projects/projects-page"
import { getProjects } from "@/features/projects/projects.functions"

export const Route = createFileRoute("/dashboard/web/projects")({
  loader: () => getProjects(),
  pendingComponent: () => <DataPageSkeleton columns={2} rows={3} withTabs />,
  component: ProjectsRoute,
})

function ProjectsRoute() {
  return <ProjectsPage loadedProjects={Route.useLoaderData()} />
}
