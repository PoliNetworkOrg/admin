import { z } from "zod"

import { errorHasCode } from "../../lib/errors.ts"
import { PROJECT_LOGO_MAX_SIZE, PROJECT_LOGO_TYPES } from "./projects.constants.ts"

const projectCategorySchema = z.enum(["news", "general", "deprecated"])
const IMAGE_TYPES = new Set<string>(PROJECT_LOGO_TYPES)

function requiredText(data: FormData, key: string, maxLength: number) {
  const result = z.string().trim().min(1).max(maxLength).safeParse(data.get(key))
  if (!result.success) throw new Error(`INVALID_${key.toUpperCase()}`)
  return result.data
}

function optionalText(data: FormData, key: string, maxLength: number) {
  const result = z.string().safeParse(data.get(key))
  if (!result.success) return null
  const trimmed = result.data.trim()
  if (trimmed.length > maxLength) throw new Error(`INVALID_${key.toUpperCase()}`)
  return trimmed || null
}

function optionalLink(data: FormData) {
  const link = optionalText(data, "link", 2048)
  if (!link) return null
  try {
    const url = new URL(link)
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_LINK")
  } catch (error) {
    console.error(error)
    throw new Error("INVALID_LINK")
  }
  return link
}

export function parseProjectForm(data: FormData) {
  const category = projectCategorySchema.safeParse(data.get("category"))
  if (!category.success) throw new Error("INVALID_CATEGORY")

  const logoValue = data.get("logoFile")
  const logoFile = logoValue instanceof File && logoValue.size > 0 ? logoValue : null
  if (logoFile && (!IMAGE_TYPES.has(logoFile.type) || logoFile.size > PROJECT_LOGO_MAX_SIZE)) {
    throw new Error(logoFile.size > PROJECT_LOGO_MAX_SIZE ? "LOGO_TOO_LARGE" : "INVALID_LOGO_TYPE")
  }

  return {
    title: requiredText(data, "title", 160),
    descriptionIt: requiredText(data, "descriptionIt", 5000),
    descriptionEn: requiredText(data, "descriptionEn", 5000),
    link: optionalLink(data),
    logo: optionalText(data, "logo", 4 * 1024 * 1024),
    logoFile,
    category: category.data,
  }
}

export function parseEditProjectForm(data: FormData) {
  const id = Number(data.get("id"))
  if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID_ID")
  return { id, ...parseProjectForm(data) }
}

/** The project form's text fields, as the MCP takes them; the logo is the `logoFile` file. The parsers decide. */
export const projectFormFields = z.object({
  title: z.string().trim().min(1).max(160),
  descriptionIt: z.string().trim().min(1).max(5000),
  descriptionEn: z.string().trim().min(1).max(5000),
  link: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .optional(),
  category: projectCategorySchema,
})
export const editProjectFormFields = projectFormFields.extend({ id: z.number().int().positive() })

export const projectIdInput = z.object({ id: z.number().int().positive() })
export const reorderProjectsInput = z.object({ projectIds: z.array(z.number().int().positive()).min(1) })

export function projectSaveErrorMessage(cause: unknown) {
  if (errorHasCode(cause, "INVALID_LINK")) return "Enter a valid HTTP or HTTPS project URL."
  if (errorHasCode(cause, "INVALID_TITLE")) return "Enter a project title no longer than 160 characters."
  if (errorHasCode(cause, "INVALID_DESCRIPTIONIT")) {
    return "Enter an Italian description no longer than 5,000 characters."
  }
  if (errorHasCode(cause, "INVALID_DESCRIPTIONEN")) {
    return "Enter an English description no longer than 5,000 characters."
  }
  if (errorHasCode(cause, "INVALID_CATEGORY")) return "Choose a valid project category."
  if (errorHasCode(cause, "LOGO_TOO_LARGE")) return "The logo must be no larger than 1 MB."
  if (errorHasCode(cause, "INVALID_LOGO_TYPE")) return "Choose an SVG, PNG, or JPEG logo."

  return "The project could not be saved. Check your permissions and try again."
}
