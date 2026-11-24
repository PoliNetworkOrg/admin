import { createServerFn } from "@tanstack/react-start"

import { webContentWriteMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import { catalogueEntrySchema, commandSchema, promotionCommandSchema, promotionQueueSchema } from "./portal.contract"

export const reviewPortalAssociation = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(commandSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).command(data))

/** Adds, renames or retires a programme or campus. The backend also requires `admin:access`. */
export const savePortalCatalogue = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(catalogueEntrySchema)
  .handler(async ({ context, data }) => (await portalApi(context)).saveCatalogue(data))

/** Operators' promotion queue across associations, filtered by status and date. */
export const getPortalPromotionQueue = createServerFn()
  .middleware([webContentWriteMiddleware])
  .validator(promotionQueueSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).promotions.queue(data))
export const reviewPortalPromotion = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(promotionCommandSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).promotions.command(data))
