import { createServerFn } from "@tanstack/react-start"

import { associationSelfMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import {
  calendarEventCommandSchema,
  calendarEventCreateSchema,
  isEventOperatorAction,
  refSchema,
} from "./portal.contract"

// Representatives' calendar events. The backend checks membership of the association on every call.
export const getPortalEvents = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).events.list(data))
export const getPortalEvent = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).events.get(data))
export const createPortalEvent = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(calendarEventCreateSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).events.create(data))
export const changePortalEvent = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(calendarEventCommandSchema)
  .handler(async ({ context, data }) => {
    // Decisions go through `reviewPortalEvent`, which requires the operator permission.
    if (isEventOperatorAction(data.action)) throw new Error("Use the authorized review action")
    return (await portalApi(context)).events.command(data)
  })
