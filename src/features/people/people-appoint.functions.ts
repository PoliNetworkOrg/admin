import { createServerFn } from "@tanstack/react-start"

import { peopleAppointMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { capoScopeInputSchema } from "./people.contract"

/** Appoints a Capo Admin of a scope, changes it, or ends the role (`scope: null`). Direttivo only. */
export const setCapoScope = createServerFn({ method: "POST" })
  .middleware([peopleAppointMiddleware])
  .validator(capoScopeInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setCapoScope(data))
