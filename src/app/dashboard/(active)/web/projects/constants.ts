import type { Project } from "./types"

export const PROJECT_CATEGORY = {
  NEWS: "news",
  GENERAL: "general",
  DEPRECATED: "deprecated",
} as const

export const PROJECT_CATEGORIES = [
  {
    value: PROJECT_CATEGORY.NEWS,
    label: "News",
    emptyLabel: 'No news projects found. Click "Add Project" to create one.',
  },
  {
    value: PROJECT_CATEGORY.GENERAL,
    label: "General",
    emptyLabel: 'No general projects found. Click "Add Project" to create one.',
  },
  {
    value: PROJECT_CATEGORY.DEPRECATED,
    label: "Deprecated",
    emptyLabel: 'No deprecated projects found. Click "Add Project" to create one.',
  },
] as const

export const DEFAULT_PROJECT: Omit<Project, "id"> = {
  title: "New Project",
  logo: null,
  descriptionIt: "Description in Italian",
  descriptionEn: "Description in English",
  link: null,
  category: PROJECT_CATEGORY.GENERAL,
}
