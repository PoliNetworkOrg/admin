import { createServerFn } from "@tanstack/react-start"

import { webContentWriteMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import { catalogueEntrySchema, commandSchema } from "./portal.contract"

export const reviewPortalAssociation = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(commandSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).command(data))

/** Adds, renames or retires a programme or campus. The backend also requires `admin:access`. */
export const savePortalCatalogue = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(catalogueEntrySchema)
  .handler(async ({ context, data }) => (await portalApi(context)).saveCatalogue(data))
