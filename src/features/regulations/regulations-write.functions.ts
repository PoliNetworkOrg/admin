import { createServerFn } from "@tanstack/react-start"

import { regulationsWriteMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import {
  applyMergeInputSchema,
  createDraftInputSchema,
  draftKindSchema,
  draftRefInputSchema,
  removeAssignmentInputSchema,
  setAssignmentInputSchema,
  stateKeySchema,
} from "./regulations.contract"

/** Regolamenti writes of the Direttivo (`regulations:write`). */

/** A Direttivo draft is always a `modifica`. */
export const createDraftInput = createDraftInputSchema.extend({ kind: draftKindSchema.extract(["modifica"]) })
/** The steps without a delibera. */
export const transitionDraftInput = draftRefInputSchema.extend({
  to: stateKeySchema.extract(["bozza", "in_approvazione"]),
})

export const createDraft = createServerFn({ method: "POST" })
  .middleware([regulationsWriteMiddleware])
  .validator(createDraftInput)
  .handler(async ({ data, context }) => (await regulationsApi(context)).createDraft(data))

/** Adds a member or changes their role. */
export const setDraftAssignment = createServerFn({ method: "POST" })
  .middleware([regulationsWriteMiddleware])
  .validator(setAssignmentInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).setAssignment(data))

export const removeDraftAssignment = createServerFn({ method: "POST" })
  .middleware([regulationsWriteMiddleware])
  .validator(removeAssignmentInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).removeAssignment(data))

export const applyMerge = createServerFn({ method: "POST" })
  .middleware([regulationsWriteMiddleware])
  .validator(applyMergeInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).applyMerge(data))

/** State changes without a delibera: "Invia in approvazione" and "Riporta in bozza". */
export const transitionDraft = createServerFn({ method: "POST" })
  .middleware([regulationsWriteMiddleware])
  .validator(transitionDraftInput)
  .handler(async ({ data, context }) => (await regulationsApi(context)).transition(data))
