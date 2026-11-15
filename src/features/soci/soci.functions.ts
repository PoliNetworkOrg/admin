import { createServerFn } from "@tanstack/react-start"

import { sociReadMiddleware } from "@/server/auth.middleware"

import { sociApi } from "./soci.api.server"
import { numberInputSchema } from "./soci.contract"

/** Soci › Register: every record, with mismatches against the Soci group, and the group's accounts without one. */
export const getSociRegister = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .handler(async ({ context }) => {
    const api = await sociApi(context)
    const [register, unregistered] = await Promise.all([
      api.list(),
      // The register still opens when Microsoft 365 can't be read; the alert then says so.
      api.unregistered().catch((error) => {
        console.error(error)
        return null
      }),
    ])
    return { register, unregistered }
  })

export const getSocio = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .validator(numberInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).get(data))

/** The register without the unregistered accounts: Edit on the socio page checks codici fiscali against it. */
export const getSociList = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .handler(async ({ context }) => (await sociApi(context)).list())
