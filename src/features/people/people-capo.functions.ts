import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { joinRequestInputSchema } from "./people.contract"

/**
 * Telegram › Capo Admin: the signed-in person's scope, its groups, their admins and requests to join. The backend
 * scopes it to the Capo Admin role on their own record; `people:self` only lets them ask.
 */
export const getCapoArea = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getCapoArea())

/** Makes the requester an admin of the group; the bot grants the rights. Only the group's Capo Admin. */
export const approveJoinRequest = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(joinRequestInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).approveJoinRequest(data))

export const declineJoinRequest = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(joinRequestInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).declineJoinRequest(data))
