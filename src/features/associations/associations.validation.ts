import { z } from "zod"
import { errorHasCode, errorHasZodField } from "../../lib/errors.ts"
import { ASSOCIATION_LOGO_MAX_SIZE, ASSOCIATION_LOGO_TYPES } from "./associations.constants.ts"

const ALLOWED_LOGO_TYPES = new Set<string>(ASSOCIATION_LOGO_TYPES)

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
  if (logo.size > ASSOCIATION_LOGO_MAX_SIZE) throw new Error("LOGO_TOO_LARGE")
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

export function associationSaveErrorMessage(cause: unknown) {
  if (errorHasCode(cause, "NOT_FOUND")) return "This association no longer exists."
  if (errorHasCode(cause, "INVALID_NAME")) return "Enter an association name no longer than 200 characters."
  if (errorHasCode(cause, "INVALID_DESCRIPTIONIT")) {
    return "Enter an Italian description no longer than 20,000 characters."
  }
  if (errorHasCode(cause, "INVALID_DESCRIPTIONEN")) {
    return "Enter an English description no longer than 20,000 characters."
  }
  if (
    errorHasCode(cause, "LOGO_TOO_LARGE") ||
    errorHasCode(cause, "INVALID_LOGO_TYPE") ||
    errorHasCode(cause, "INVALID_FILE_TYPE") ||
    errorHasZodField(cause, "logo")
  ) {
    return "Choose a JPG, PNG, or SVG logo no larger than 1 MB."
  }

  return "The association could not be saved. Check your permissions and try again."
}
