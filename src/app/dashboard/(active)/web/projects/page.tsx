import { trpc } from "@/server/trpc"
import { ProjectsView } from "./projects-view"
import type { Project } from "./types"

export default async function WebProjectsIndex() {
  const projects: Project[] = await trpc.web.projects.getAllProjects.query()

  return (
    <div className="container">
      <ProjectsView initialProjects={projects} />
    </div>
  )
}
