import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { regulationsManageMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import {
  createDocumentInputSchema,
  draftRefInputSchema,
  MAX_UPLOAD_BYTES,
  stateKeySchema,
  transitionInputSchema,
  uploadDocumentFieldsSchema,
  uploadVersionFieldsSchema,
} from "./regulations.contract"

/** Regolamenti steps of the Presidente and the Segretario (`regulations:manage`). */

/** Records the outcome: the body, the day of the vote and, optionally, the verbale. */
export const approveDraft = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(transitionInputSchema.required({ delibera: true }).extend({ to: stateKeySchema.extract(["approvata"]) }))
  .handler(async ({ data, context }) => (await regulationsApi(context)).transition(data))

/**
 * Back from `approvata` to `bozza`: the recorded approval stops counting (the backend withdraws the delibera and frees
 * the text). Refused once an emanation has started.
 */
export const withdrawApproval = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).transition({ ...data, to: "bozza" }))

/**
 * `emanation.start`: "Emana e notifica" (PR, CI, merge, tag, release, then email and Telegram) or, for a `documento`,
 * "Pubblica" (the same through the release for a repository document, at once in the database for a private one).
 */
export const emanateDraft = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).startEmanation(data))

export const regenerateDiff = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).regenerateDiff(data))

/**
 * Imports `documents.json`: new documents with their current sources as the first version, and a new version of a
 * sola consultazione document whose sources changed. Says what it skipped and why.
 */
export const syncRegulationDocuments = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .handler(async ({ context }) => (await regulationsApi(context)).syncDocuments())

/** A document from a template: a pull request on the repository, or a private copy kept only in the backend. */
export const createRegulationDocument = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(createDocumentInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).createDocument(data))

const pdfFile = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Il file è vuoto.")
  .refine((file) => file.size <= MAX_UPLOAD_BYTES, "Il PDF supera i 20 MB.")

/** The form "Carica un PDF" sends: key, title and the file. The backend checks the file is a PDF. */
export function parseDocumentUpload(form: FormData) {
  return uploadDocumentFieldsSchema
    .extend({ file: pdfFile })
    .parse({ key: form.get("key"), title: form.get("title"), file: form.get("file") })
}

/** The form "Carica nuova versione" sends: the document and the file. */
export function parseVersionUpload(form: FormData) {
  return uploadVersionFieldsSchema.extend({ file: pdfFile }).parse({
    documentKey: form.get("documentKey"),
    file: form.get("file"),
  })
}

/** A private, read-only document from a PDF: never on GitHub. */
export const uploadRegulationDocument = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator((form: FormData) => parseDocumentUpload(form))
  .handler(async ({ data, context }) => (await regulationsApi(context)).uploadDocument(data))

/** A new version of an uploaded document. */
export const uploadRegulationVersion = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator((form: FormData) => parseVersionUpload(form))
  .handler(async ({ data, context }) => (await regulationsApi(context)).uploadVersion(data))
