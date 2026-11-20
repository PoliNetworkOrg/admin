import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { todayIso } from "@/features/people/people-format"
import { sociReadMiddleware } from "@/server/auth.middleware"

import { feeYearsSince } from "./soci-fees"
import { sociApi } from "./soci.api.server"
import { feeYearSchema, fileInputSchema, numberInputSchema } from "./soci.contract"

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

/**
 * Soci › Fees: one fee year's fees, with the totals per status, and the fee years to choose from (back to the oldest
 * admission's).
 */
export const getSociFees = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .validator(z.object({ year: feeYearSchema.optional() }))
  .handler(async ({ data, context }) => {
    const api = await sociApi(context)
    const [fees, register] = await Promise.all([api.fees.list({ year: data.year }), api.list()])
    const oldest = register.members.map((socio) => socio.admittedOn).sort()[0] ?? null
    return { fees, years: feeYearsSince(oldest, todayIso()) }
  })

/** An uploaded transfer receipt, in base64. */
export const getFeeFile = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .validator(fileInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).fees.file(data))

/** The receipts waiting for review this fee year: the count next to Soci › Fees in the panel. */
export const getFeesToReviewCount = createServerFn({ method: "GET" })
  .middleware([sociReadMiddleware])
  .handler(async ({ context }) => (await (await sociApi(context)).fees.list({ status: "uploaded" })).totals.uploaded)
