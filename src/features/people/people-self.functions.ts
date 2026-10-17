import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  answerCensusInputSchema,
  askToBeAddedInputSchema,
  correctionInputSchema,
  receiptInputSchema,
  transferInputSchema,
} from "./people.contract"

const TRANSFER_MAX_SIZE = 10 * 1024 * 1024
const TRANSFER_TYPES = /\.(pdf|jpe?g|png)$/i

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

/** The member's bank receipt for this year's fee; an admin reviews it. */
export const uploadMyTransferReceipt = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator((data: FormData) => {
    const file = data.get("file")
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose the transfer receipt.")
    if (!TRANSFER_TYPES.test(file.name)) throw new Error("Choose a PDF, JPG or PNG file.")
    if (file.size > TRANSFER_MAX_SIZE) throw new Error("The file is larger than 10 MB.")
    const fields = transferInputSchema.safeParse({
      transferDate: data.get("transferDate"),
      amountCents: Number(data.get("amountCents")),
    })
    if (!fields.success) throw new Error("Enter the transfer date and amount.")
    return { file, ...fields.data }
  })
  .handler(async ({ data: { file, ...input }, context }) =>
    (await peopleApi(context)).uploadTransferReceipt(file, input)
  )

/** One of the member's own signed receipts. */
export const downloadMyReceipt = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .validator(receiptInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).downloadMyReceipt(data))
