import { createServerFn } from "@tanstack/react-start"

import { regulationsAssigneeMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import {
  createDraftInputSchema,
  draftKindSchema,
  draftRefInputSchema,
  renameDraftInputSchema,
} from "./regulations.contract"

/**
 * Regolamenti writes the backend authorizes per draft: assignments (editor, commenter) and deleghe are backend data,
 * so the dashboard admits the caller and the backend decides.
 */

/** Direttivo, or whoever started a rettifica. */
export const renameDraft = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(renameDraftInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).renameDraft(data))

/** Soft delete, while `bozza`: Direttivo, or whoever started a rettifica. */
export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).deleteDraft(data))

/** A rettifica, from the latest version: the Segretario (`regulations:rectify`) or a delega holder. */
export const createRectification = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(createDraftInputSchema.extend({ kind: draftKindSchema.extract(["rettifica"]) }))
  .handler(async ({ data, context }) => (await regulationsApi(context)).createDraft(data))

/** "Emana rettifica": straight from `bozza`, by the Segretario or a delega holder. */
export const emanateRectification = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).startEmanation(data))

/** Resumes a failed emanation where it stopped; every step is idempotent. */
export const retryEmanation = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).retryEmanation(data))
