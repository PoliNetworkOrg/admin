import { createServerFn } from "@tanstack/react-start"

import { associationSelfMiddleware } from "@/server/auth.middleware"

import { portalApi } from "./portal.api.server"
import {
  commandSchema,
  createSchema,
  inviteSchema,
  isApplicantAction,
  logoFormSchema,
  refSchema,
} from "./portal.contract"

// Every authenticated account can apply. The backend authorizes each record from current membership.
export const getPortal = createServerFn()
  .middleware([associationSelfMiddleware])
  .handler(({ context }) => portalApi(context).list())
export const getPortalDirectory = createServerFn()
  .middleware([associationSelfMiddleware])
  .handler(({ context }) => portalApi(context).directory())
export const getPortalAssociation = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(({ context, data }) => portalApi(context).get(data))
export const getPortalInvitation = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(inviteSchema)
  .handler(({ context, data }) => portalApi(context).invitation(data))
export const createPortalAssociation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(createSchema)
  .handler(({ context, data }) => portalApi(context).create(data))
export const changePortalAssociation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(commandSchema)
  .handler(({ context, data }) => {
    // An allow-list: any action added to the contract needs an explicit decision before applicants can send it.
    if (!isApplicantAction(data.action)) throw new Error("Use the authorized review action")
    return portalApi(context).command(data)
  })
export const acceptPortalInvitation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(inviteSchema)
  .handler(({ context, data }) => portalApi(context).accept(data))

export const uploadPortalLogo = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(logoFormSchema)
  .handler(({ context, data }) => portalApi(context).uploadLogo(data))
