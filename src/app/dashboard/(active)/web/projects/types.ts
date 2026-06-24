import type { PROJECT_CATEGORY } from "./constants"

export type ProjectCategory = (typeof PROJECT_CATEGORY)[keyof typeof PROJECT_CATEGORY]

export type Project = {
  id: number
  title: string
  descriptionIt: string
  descriptionEn: string
  logo: string | null
  link: string | null
  category: ProjectCategory
}

export type ProjectSaveValues = Project & {
  logoFile?: File | null
}

export type ProjectsReorder = {
  nextProjects: Project[]
  orderedIds: number[]
  previousProjects: Project[]
}

export type ProjectsDragProps = {
  projects: Project[]
  activeCategory: ProjectCategory
  editingProjectId: number | null
  draftProjectIds: Set<number>
  onReorder: (reorder: ProjectsReorder) => void
  onCancelCreate: (id: number) => void
  onDelete: (id: number) => void
  onCategoryChange: (id: number, category: ProjectCategory) => void
  onSave: (id: number, values: ProjectSaveValues) => Promise<boolean>
}

export type CardProjectProps = Project & {
  initialEditActive?: boolean
  isDraft?: boolean
  sortableIndex?: number
  onCancelCreate?: () => void
  onDelete: () => void
  onCategoryChange: (category: ProjectCategory) => void
  onSave: (values: ProjectSaveValues) => boolean | Promise<boolean>
}
