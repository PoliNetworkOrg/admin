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
