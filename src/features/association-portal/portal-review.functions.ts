import { createServerFn } from "@tanstack/react-start"

import { webContentWriteMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import { commandSchema } from "./portal.contract"

export const reviewPortalAssociation = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(commandSchema)
  .handler(({ context, data }) => portalApi(context).command(data))
