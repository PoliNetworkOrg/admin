import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  regulationsAssigneeMiddleware,
  regulationsReadMiddleware,
  regulationsWriteMiddleware,
} from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import {
  compilePdfInputSchema,
  documentKeySchema,
  draftRefInputSchema,
  listDraftsInputSchema,
  mergeInputSchema,
  snapshotRefInputSchema,
  userSearchInputSchema,
} from "./regulations.contract"

/**
 * Regolamenti reads. Draft-scoped ones run for anyone the dashboard admits: the backend answers only for drafts the
 * caller may see (an assignment, a delega, or `regulations:read`).
 */

/** How the signed-in user reaches Regolamenti: drafts they're assigned to, deleghe, and their permissions. */
export const getMyRegulations = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .handler(async ({ context }) => (await regulationsApi(context)).getMe())

export const getRegulationDocuments = createServerFn({ method: "GET" })
  .middleware([regulationsReadMiddleware])
  .handler(async ({ context }) => (await regulationsApi(context)).listDocuments())

/** A document with its published versions, newest first, and its drafts. */
export const getRegulationDocument = createServerFn({ method: "GET" })
  .middleware([regulationsReadMiddleware])
  .validator(z.object({ documentKey: documentKeySchema }))
  .handler(async ({ data, context }) => {
    const api = await regulationsApi(context)
    const [document, versions, drafts] = await Promise.all([
      api.getDocument(data),
      api.listVersions(data),
      api.listDrafts({ documentKey: data.documentKey, includeClosed: true }),
    ])
    return { document, versions, drafts }
  })

export const getVersionPdf = createServerFn({ method: "GET" })
  .middleware([regulationsReadMiddleware])
  .validator(z.object({ versionId: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => (await regulationsApi(context)).versionPdf(data))

export const getDrafts = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(listDraftsInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).listDrafts(data))

export const getDraft = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).getDraft(data))

/** The draft with its members; the members list is the backend's to give (an assignee sees who else works on it). */
export const getDraftWithMembers = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => {
    const api = await regulationsApi(context)
    const [draft, members] = await Promise.all([api.getDraft(data), api.listAssignments(data)])
    return { draft, members }
  })

/** The saved text and the parser's structure and problems. */
export const getDraftFiles = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).draftFiles(data))

export const getCompileStatus = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).compileStatus(data))

/** The preview PDF of one source hash, base64-encoded: the browser can't reach the backend. */
export const getDraftPdf = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(compilePdfInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).compilePdf(data))

export const getSnapshots = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).listSnapshots(data))

export const getSnapshot = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(snapshotRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).getSnapshot(data))

export const getComments = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).listComments(data))

export const getDiff = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).getDiff(data))

export const getDiffPdf = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).diffPdf(data))

export const getEmanation = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).getEmanation(data))

/** The Segretario sees every delega; anyone else only their own. */
export const getDeleghe = createServerFn({ method: "GET" })
  .middleware([regulationsAssigneeMiddleware])
  .handler(async ({ context }) => (await regulationsApi(context)).listDeleghe())

export const getMergePreview = createServerFn({ method: "GET" })
  .middleware([regulationsWriteMiddleware])
  .validator(mergeInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).previewMerge(data))

/** Any IdP account (not only Soci), to assign to a draft or give a delega. */
export const searchRegulationUsers = createServerFn({ method: "GET" })
  .middleware([regulationsWriteMiddleware])
  .validator(userSearchInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).searchUsers(data))
