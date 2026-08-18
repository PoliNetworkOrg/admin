import type { WebProject } from "@/lib/api/types"

export type Project = WebProject
export type ProjectCategory = Project["category"]

export type ProjectFormValues = Omit<Project, "id" | "logo"> & {
  logo: string | null
  logoFile?: File | null
}

export type ProjectReorder = {
  nextProjects: Project[]
  orderedIds: number[]
  previousProjects: Project[]
}
