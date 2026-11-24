import { createServerFn } from "@tanstack/react-start"

import { associationSelfMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import { refSchema } from "./portal.contract"

/** The association's credits: representatives see them once PoliNetwork has turned credits on. */
export const getPortalCredits = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).credits.account(data))
