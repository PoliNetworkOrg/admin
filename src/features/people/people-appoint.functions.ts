import { createServerFn } from "@tanstack/react-start"

import { peopleAppointMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { appointCapoInputSchema, capoScopeInputSchema, endAssignmentInputSchema } from "./people.contract"

/** Appoints a current admin Capo Admin of a scope. */
export const appointCapo = createServerFn({ method: "POST" })
  .middleware([peopleAppointMiddleware])
  .validator(appointCapoInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).appointCapo(data))

/** Changes a Capo Admin's scope: People's own data, nothing changes in Auth. */
export const setCapoScope = createServerFn({ method: "POST" })
  .middleware([peopleAppointMiddleware])
  .validator(capoScopeInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setCapoScope(data))

/** Ends the Capo Admin role; they stay an admin, and their admins have no Capo Admin of reference until one is set. */
export const endCapo = createServerFn({ method: "POST" })
  .middleware([peopleAppointMiddleware])
  .validator(endAssignmentInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).endCapo(data))
