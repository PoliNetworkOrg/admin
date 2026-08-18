import { z } from "zod"

const MAX_LOGO_SIZE = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/svg+xml"])

function requiredText(data: FormData, key: string, maximum: number) {
  const value = data.get(key)
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`INVALID_${key.toUpperCase()}`)
  }
  return value.trim()
}

function optionalLogo(data: FormData) {
  const logo = data.get("logo")
  if (logo === null || (typeof logo === "string" && logo === "")) return null
  if (typeof logo === "string") {
    if (logo.length > 3_000_000) throw new Error("LOGO_TOO_LARGE")
    return logo
  }
  if (!(logo instanceof File) || !ALLOWED_LOGO_TYPES.has(logo.type)) throw new Error("INVALID_LOGO_TYPE")
  if (logo.size > MAX_LOGO_SIZE) throw new Error("LOGO_TOO_LARGE")
  return logo
}

function associationFields(data: FormData) {
  return {
    name: requiredText(data, "name", 200),
    descriptionIt: requiredText(data, "descriptionIt", 20_000),
    descriptionEn: requiredText(data, "descriptionEn", 20_000),
    logo: optionalLogo(data),
  }
}

export function parseCreateAssociationForm(data: FormData) {
  return associationFields(data)
}

export function parseEditAssociationForm(data: FormData) {
  const id = Number(data.get("id"))
  if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID_ID")
  return { id, ...associationFields(data) }
}

const nullableUrl = z.union([z.url().max(2_048), z.null()])
const nullableEmail = z.union([z.email().max(320), z.null()])

export const associationLinksInput = z.object({
  id: z.number().int().positive(),
  links: z.object({
    email: nullableEmail,
    website: nullableUrl,
    facebook: nullableUrl,
    instagram: nullableUrl,
    tiktok: nullableUrl,
    x: nullableUrl,
    youtube: nullableUrl,
    telegram: nullableUrl,
    linkedin: nullableUrl,
    spotify: nullableUrl,
  }),
})

export const associationIdInput = z.object({ id: z.number().int().positive() })
