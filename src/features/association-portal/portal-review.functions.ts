import { createServerFn } from "@tanstack/react-start"

import { webContentWriteMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import {
  calendarEventCommandSchema,
  calendarEventQueueSchema,
  catalogueEntrySchema,
  commandSchema,
  creditConfigSchema,
  creditOperationSchema,
  creditSemesterSchema,
  promotionCommandSchema,
  promotionQueueSchema,
} from "./portal.contract"

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

/** Operators' event queue across associations, filtered by status and date. */
export const getPortalEventQueue = createServerFn()
  .middleware([webContentWriteMiddleware])
  .validator(calendarEventQueueSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).events.queue(data))
export const reviewPortalEvent = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(calendarEventCommandSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).events.command(data))

/** Credit rules (RRI art. 4.7), grants and adjustments: operators only, like the other queues. */
export const getCreditConfig = createServerFn()
  .middleware([webContentWriteMiddleware])
  .handler(async ({ context }) => (await portalApi(context)).credits.config())
export const saveCreditConfig = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(creditConfigSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).credits.saveConfig(data))
export const operateCredits = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(creditOperationSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).credits.operate(data))
export const grantSemesterCredits = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(creditSemesterSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).credits.semester(data))
