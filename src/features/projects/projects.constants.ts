import type { LogoRules } from "../web/logo-upload.tsx"
import type { ProjectCategory } from "./types"

export const PROJECT_CATEGORIES = [
  { value: "news", label: "News" },
  { value: "general", label: "General" },
  { value: "deprecated", label: "Deprecated" },
] as const satisfies readonly { value: ProjectCategory; label: string }[]
const projectCategoryValues = new Set<string>(PROJECT_CATEGORIES.map(({ value }) => value))

export const PROJECT_LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg"] as const
export const PROJECT_LOGO_MAX_SIZE = 1024 * 1024

export const PROJECT_LOGO_RULES: LogoRules = {
  types: PROJECT_LOGO_TYPES,
  maxSize: PROJECT_LOGO_MAX_SIZE,
  typeError: "Choose an SVG, PNG, or JPEG logo.",
  sizeError: "The logo must be no larger than 1 MB.",
  hint: "SVG, PNG or JPEG, up to 1 MB",
}

export const PROJECT_TITLE_MAX_LENGTH = 160
export const PROJECT_DESCRIPTION_MAX_LENGTH = 5000
export const PROJECT_LINK_MAX_LENGTH = 2048

export function getProjectCategoryLabel(category: ProjectCategory) {
  return PROJECT_CATEGORIES.find((item) => item.value === category)?.label ?? category
}

export function isProjectCategory(value: string): value is ProjectCategory {
  return projectCategoryValues.has(value)
}
