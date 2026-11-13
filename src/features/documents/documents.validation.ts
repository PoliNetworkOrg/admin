import { z } from "zod"

import { errorHasCode } from "../../lib/errors.ts"

export const DOCUMENT_SLUG_MAX_LENGTH = 100
export const DOCUMENT_TITLE_MAX_LENGTH = 200
export const DOCUMENT_DESCRIPTION_MAX_LENGTH = 2000
export const DOCUMENT_VERSION_MAX_LENGTH = 50
const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024

/** The backend's slug rule: lowercase kebab-case. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slug = z
  .string()
  .trim()
  .min(1, "Enter a slug.")
  .max(DOCUMENT_SLUG_MAX_LENGTH, `Keep the slug within ${DOCUMENT_SLUG_MAX_LENGTH} characters.`)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens, such as statuto-2024.")
const title = z
  .string()
  .trim()
  .min(1, "Enter a title.")
  .max(DOCUMENT_TITLE_MAX_LENGTH, `Keep the title within ${DOCUMENT_TITLE_MAX_LENGTH} characters.`)
const description = z
  .string()
  .trim()
  .max(DOCUMENT_DESCRIPTION_MAX_LENGTH, "Keep the description within 2,000 characters.")
const id = z.number().int().positive()
const order = z
  .array(id)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids")

export const documentCategoryInput = z.object({ slug, title, description }).strict()
export const updateDocumentCategoryInput = documentCategoryInput.extend({ id }).strict()
export const reorderDocumentCategoriesInput = z.object({ ids: order }).strict()

/** An empty description is stored as none. */
export const documentInput = z.object({ categoryId: id, slug, title, description }).strict()
export const updateDocumentInput = documentInput.extend({ id }).strict()
export const reorderDocumentsInput = z.object({ categoryId: id, ids: order }).strict()

export const documentIdInput = z.object({ id }).strict()

/** A PDF up to 10 MB: the rule the server enforces, checked in the dialog before uploading. */
export function isValidDocumentFile(file: File) {
  return file.type === "application/pdf" && file.size > 0 && file.size <= MAX_DOCUMENT_FILE_BYTES
}

export function parseDocumentVersionForm(data: FormData) {
  const documentId = z.coerce.number().int().positive().safeParse(data.get("documentId"))
  const version = z.string().trim().min(1).max(DOCUMENT_VERSION_MAX_LENGTH).safeParse(data.get("version"))
  const date = z.iso.date().safeParse(data.get("date"))
  const file = data.get("file")

  if (!documentId.success) throw new Error("INVALID_DOCUMENT")
  if (!version.success) throw new Error("INVALID_VERSION")
  if (!date.success) throw new Error("INVALID_DATE")
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0) {
    throw new Error("INVALID_FILE_TYPE")
  }
  if (file.size > MAX_DOCUMENT_FILE_BYTES) throw new Error("FILE_TOO_LARGE")
  return { documentId: documentId.data, version: version.data, date: date.data, file }
}

/** A slug suggested from a title: "Statuto dell'Associazione 2024" → "statuto-dell-associazione-2024". */
export function slugFromTitle(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, DOCUMENT_SLUG_MAX_LENGTH)
    .replace(/-+$/, "")
}

/** The first message of each invalid field, for the dialogs. */
export function fieldErrors<Field extends string>(error: z.ZodError, fields: readonly Field[]) {
  const errors: Partial<Record<Field, string>> = {}
  for (const issue of error.issues) {
    const field = fields.find((candidate) => candidate === issue.path[0])
    if (field && !errors[field]) errors[field] = issue.message
  }
  return errors
}

type Subject = "category" | "document" | "version"

/** A clear message for every error the documents procedures and their server functions report. */
export function documentsErrorMessage(cause: unknown, subject: Subject, fallback: string) {
  if (errorHasCode(cause, "UNAUTHORIZED")) return "You do not have permission to edit the website's documents."
  if (errorHasCode(cause, "CATEGORY_NOT_EMPTY")) {
    return "This category still has documents. Move them to another category or delete them first."
  }
  if (errorHasCode(cause, "CATEGORY_NOT_FOUND")) {
    return "The chosen category no longer exists. Reload the page and choose another one."
  }
  if (errorHasCode(cause, "DUPLICATE_SLUG")) {
    return subject === "category"
      ? "Another category already uses this slug."
      : "Another document already uses this slug."
  }
  if (errorHasCode(cause, "INVALID_ORDER"))
    return "The list changed while you were reordering it. Reload and try again."
  if (errorHasCode(cause, "DUPLICATE_VERSION")) return "This document already has a version with this name."
  if (errorHasCode(cause, "NOT_FOUND") || errorHasCode(cause, "INVALID_DOCUMENT")) {
    return `This ${subject === "version" ? "document or version" : subject} no longer exists. Reload the page.`
  }
  if (errorHasCode(cause, "FILE_TOO_LARGE") || errorHasCode(cause, "INVALID_FILE_TYPE")) {
    return "Choose a PDF file no larger than 10 MB."
  }
  if (errorHasCode(cause, "INVALID_VERSION")) return "Enter a version of up to 50 characters."
  if (errorHasCode(cause, "INVALID_DATE")) return "Choose a valid date."
  return fallback
}
