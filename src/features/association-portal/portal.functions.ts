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
  .handler(async ({ context }) => (await portalApi(context)).list())
/** What needs the viewer's attention, and operators' queue counters. */
export const getPortalHome = createServerFn()
  .middleware([associationSelfMiddleware])
  .handler(async ({ context }) => (await portalApi(context)).home())
export const getPortalDirectory = createServerFn()
  .middleware([associationSelfMiddleware])
  .handler(async ({ context }) => (await portalApi(context)).directory())
/** Active programmes and campuses for everyone; operators also receive retired entries. */
export const getPortalCatalogue = createServerFn()
  .middleware([associationSelfMiddleware])
  .handler(async ({ context }) => (await portalApi(context)).catalogue())
export const getPortalAssociation = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(refSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).get(data))
export const getPortalInvitation = createServerFn()
  .middleware([associationSelfMiddleware])
  .validator(inviteSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).invitation(data))
export const createPortalAssociation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(createSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).create(data))
export const changePortalAssociation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(commandSchema)
  .handler(async ({ context, data }) => {
    // An allow-list: any action added to the contract needs an explicit decision before applicants can send it.
    if (!isApplicantAction(data.action)) throw new Error("Use the authorized review action")
    return (await portalApi(context)).command(data)
  })
export const acceptPortalInvitation = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(inviteSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).accept(data))

export const uploadPortalLogo = createServerFn({ method: "POST" })
  .middleware([associationSelfMiddleware])
  .validator(logoFormSchema)
  .handler(async ({ context, data }) => (await portalApi(context)).uploadLogo(data))
