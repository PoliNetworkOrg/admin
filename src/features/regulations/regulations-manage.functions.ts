import { createServerFn } from "@tanstack/react-start"

import { regulationsManageMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import { draftRefInputSchema, stateKeySchema, transitionInputSchema } from "./regulations.contract"

/** Regolamenti steps of the Presidente and the Segretario (`regulations:manage`). */

/** Records the outcome: the body, the day of the vote and, optionally, the verbale. */
export const approveDraft = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(transitionInputSchema.required({ delibera: true }).extend({ to: stateKeySchema.extract(["approvata"]) }))
  .handler(async ({ data, context }) => (await regulationsApi(context)).transition(data))

/** "Emana e notifica": PR, CI, merge, tag, release, then email and Telegram. */
export const emanateDraft = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).startEmanation(data))

export const regenerateDiff = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).regenerateDiff(data))

/** Imports `legal.json` and the current sources as a published version (setup). */
export const syncRegulationDocuments = createServerFn({ method: "POST" })
  .middleware([regulationsManageMiddleware])
  .handler(async ({ context }) => (await regulationsApi(context)).syncDocuments())
