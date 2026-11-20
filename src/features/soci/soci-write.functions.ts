import { createServerFn } from "@tanstack/react-start"

import { sociWriteMiddleware } from "@/server/auth.middleware"

import { sociApi } from "./soci.api.server"
import {
  admitInputSchema,
  markPaidInputSchema,
  registerInputSchema,
  rejectInputSchema,
  reviewInputSchema,
  setNumberInputSchema,
  updateInputSchema,
} from "./soci.contract"

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

/**
 * The reviewed receipt is good: the fee is paid on its transfer date, and the socio gets an email. `fileId` names the
 * receipt reviewed, so a newer upload in the meantime makes it fail.
 */
export const confirmFee = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(reviewInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).fees.confirm(data))

/** The fee is Due again, and the socio gets the reason by email and in My area. */
export const rejectFee = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(rejectInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).fees.reject(data))

/** A payment made outside the dashboard; opens the fee year for the socio if it hasn't been opened yet. */
export const markFeePaid = createServerFn({ method: "POST" })
  .middleware([sociWriteMiddleware])
  .validator(markPaidInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).fees.markPaid(data))
