import { createServerFn } from "@tanstack/react-start"

import { peopleTeamWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { personRefInputSchema } from "./people.contract"

/**
 * Sends an invite to the record's contact email, or a new one replacing the open invite (its link stops working).
 * `people:write`, or the Lead of one of the person's teams: the backend decides.
 */
export const sendPersonInvite = createServerFn({ method: "POST" })
  .middleware([peopleTeamWriteMiddleware])
  .validator(personRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).sendInvite(data))

export const revokePersonInvite = createServerFn({ method: "POST" })
  .middleware([peopleTeamWriteMiddleware])
  .validator(personRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).revokeInvite(data))
