import { createServerFn } from "@tanstack/react-start"

import { regulationsRectifyMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import { createDelegaInputSchema, delegaRefInputSchema } from "./regulations.contract"

/**
 * The Segretario's deleghe to rectify (`regulations:rectify`). The backend emails direttivo@polinetwork.org on each
 * creation and revocation.
 */

export const createDelega = createServerFn({ method: "POST" })
  .middleware([regulationsRectifyMiddleware])
  .validator(createDelegaInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).createDelega(data))

export const revokeDelega = createServerFn({ method: "POST" })
  .middleware([regulationsRectifyMiddleware])
  .validator(delegaRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).revokeDelega(data))
