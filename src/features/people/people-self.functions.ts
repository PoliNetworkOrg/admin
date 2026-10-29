import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { acceptInviteInputSchema } from "./people.contract"

/** Account › My area: the signed-in person's record, or nothing yet. */
export const getMyArea = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getMyArea())

/** The invite link HR emails: links the signed-in account to the invited record. */
export const acceptMyInvite = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(acceptInviteInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).acceptInvite(data))
