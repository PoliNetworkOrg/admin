import { PROJECT_LOGO_MAX_SIZE, PROJECT_LOGO_TYPES } from "./projects.constants.ts"

const PROJECT_CATEGORIES = new Set(["news", "general", "deprecated"])
const IMAGE_TYPES = new Set<string>(PROJECT_LOGO_TYPES)

function requiredText(data: FormData, key: string, maxLength: number) {
  const value = data.get(key)
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`INVALID_${key.toUpperCase()}`)
  }
  return value.trim()
}

function optionalText(data: FormData, key: string, maxLength: number) {
  const value = data.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length > maxLength) throw new Error(`INVALID_${key.toUpperCase()}`)
  return trimmed || null
}

function optionalLink(data: FormData) {
  const link = optionalText(data, "link", 2048)
  if (!link) return null
  try {
    const url = new URL(link)
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_LINK")
  } catch {
    throw new Error("INVALID_LINK")
  }
  return link
}

export function parseProjectForm(data: FormData) {
  const category = data.get("category")
  if (typeof category !== "string" || !PROJECT_CATEGORIES.has(category)) throw new Error("INVALID_CATEGORY")

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
    category: category as "news" | "general" | "deprecated",
  }
}
