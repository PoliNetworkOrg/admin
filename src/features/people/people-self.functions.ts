import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  acceptInviteInputSchema,
  answerCensusInputSchema,
  askToBeAddedInputSchema,
  correctionInputSchema,
} from "./people.contract"

/** Account › My area: the signed-in person's record, a first-sign-in match, or nothing yet. */
export const getMyArea = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getMyArea())

/** "Yes, link my account" on the first-sign-in match. */
export const confirmMyMatch = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).confirmMatch())

/** "This isn't me": the backend opens a Needs review item for HR. */
export const rejectMyMatch = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).rejectMatch())

/** The invite link HR emails: links the signed-in account to the invited record. */
export const acceptMyInvite = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(acceptInviteInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).acceptInvite(data))

export const askToBeAdded = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(askToBeAddedInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).askToBeAdded(data))

export const answerMyCensus = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(answerCensusInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).answerCensus(data))

/** People can't edit their record; HR checks the request and applies it. */
export const requestCorrection = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(correctionInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).requestCorrection(data))

export const revokePhotoConsent = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).revokePhotoConsent())
