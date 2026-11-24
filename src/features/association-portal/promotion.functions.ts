import { createServerFn } from "@tanstack/react-start"

import { associationSelfMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import {
  isPromotionOperatorAction,
  posterFormSchema,
  promotionCommandSchema,
  promotionCreateSchema,
  refSchema,
} from "./portal.contract"

// Representatives' promotion requests. The backend checks membership of the association on every call.
export const getPortalPromotions = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).promotions.list(data))
export const getPortalPromotion = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).promotions.get(data))
export const createPortalPromotion = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(promotionCreateSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).promotions.create(data))
export const changePortalPromotion = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(promotionCommandSchema)
  .handler(async ({ context, data }) => {
    // Decisions go through `reviewPortalPromotion`, which requires the operator permission.
    if (isPromotionOperatorAction(data.action)) throw new Error("Use the authorized review action")
    return (await portalApi(context)).promotions.command(data)
  })
export const uploadPortalPoster = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(posterFormSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).uploadPoster(data))
