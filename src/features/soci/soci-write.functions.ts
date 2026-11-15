import { createServerFn } from "@tanstack/react-start"

import { sociWriteMiddleware } from "@/server/auth.middleware"

import { sociApi } from "./soci.api.server"
import { admitInputSchema, registerInputSchema, setNumberInputSchema, updateInputSchema } from "./soci.contract"

/**
 * A new Microsoft 365 account in Soci (licences, `employeeId`, welcome email), then its record. The backend deletes the
 * account if the record can't be written.
 */
export const admitSocio = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(admitInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).admit(data))

/** A record for an account already in Soci, with its current member number. */
export const registerSocio = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(registerInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).register(data))

export const updateSocio = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(updateInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).update(data))

/** The number on the account (`employeeId`) and on the record; the old one is never given to anyone else. */
export const setSocioNumber = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(setNumberInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).setNumber(data))
