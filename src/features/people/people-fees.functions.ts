import { createServerFn } from "@tanstack/react-start"

import { peopleFeesWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  feePersonInputSchema,
  feeRemindInputSchema,
  markPaidInputSchema,
  receiptInputSchema,
  rejectFeeInputSchema,
  voidReceiptInputSchema,
} from "./people.contract"

/** Review receipt: the member, their current fee year and the number approving would issue. */
export const getFeeReview = createServerFn({ method: "GET" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(feePersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).getFeeReview(data))

/** The member's uploaded transfer receipt, for the preview. */
export const getFeeUpload = createServerFn({ method: "GET" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(feePersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).getFeeUpload(data))

/** Marks the fee paid and issues the next receipt for the President to sign. */
export const approveFee = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(feePersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).approveFee(data))

/** Sends the receipt back: the member sees the reason in My area and by email. */
export const rejectFee = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(rejectFeeInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).rejectFee(data))

/** A fee paid without an uploaded receipt (cash, or a transfer checked on the bank statement). */
export const markFeePaid = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(markPaidInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).markFeePaid(data))

/** One member, or every Due and Unpaid fee; the backend skips people reminded in the last 3 days. */
export const sendFeeReminders = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(feeRemindInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).remindFees(data))

/** Emails a signed receipt again after the first attempt failed. */
export const retryReceipt = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(receiptInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).retryReceipt(data))

/** Receipts are never deleted: voiding keeps the number and the file, with the reason. */
export const voidReceipt = createServerFn({ method: "POST" })
  .middleware([peopleFeesWriteMiddleware])
  .validator(voidReceiptInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).voidReceipt(data))
