import type { Project, ProjectCategory } from "./types"

export const PROJECT_CATEGORIES = [
  { value: "news", label: "News" },
  { value: "general", label: "General" },
  { value: "deprecated", label: "Deprecated" },
] as const satisfies readonly { value: ProjectCategory; label: string }[]

export const PROJECT_LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg"] as const
export const PROJECT_LOGO_MAX_SIZE = 1024 * 1024

export const DEFAULT_PROJECT: Omit<Project, "id"> = {
  title: "New project",
  logo: null,
  descriptionIt: "Descrizione in italiano",
  descriptionEn: "Description in English",
  link: null,
  category: "general",
}

export function getProjectCategoryLabel(category: ProjectCategory) {
  return PROJECT_CATEGORIES.find((item) => item.value === category)?.label ?? category
}
