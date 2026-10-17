import type { WebProject } from "@/lib/api/types"

export type Project = WebProject
export type ProjectCategory = Project["category"]

/** The inline edit's values; `logo` is the shown image (saved URL or a chosen file's preview). */
export type ProjectForm = Pick<Project, "title" | "descriptionIt" | "descriptionEn" | "logo"> & {
  link: string
  logoFile: File | null
}
