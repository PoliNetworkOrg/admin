import { createServerFn } from "@tanstack/react-start"

import {
  esignSignWriteMiddleware,
  peopleMembersReadMiddleware,
  peopleReceiptsSignMiddleware,
} from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  MAX_SIGNED_FILES,
  prepareReceiptSignaturesInputSchema,
  receiptInputSchema,
  receiptsInputSchema,
  sendSignedInputSchema,
} from "./people.contract"

const SIGNED_MAX_SIZE = 10 * 1024 * 1024
const SIGNED_MAX_TOTAL = 50 * 1024 * 1024
const SIGNED_MAX_NAME = 200
const SIGNED_EXTENSIONS = /\.(pdf|p7m)$/i

/** People › Receipts: one fee year (the current one for `null`) and the viewer's signing office. */
export const getReceipts = createServerFn({ method: "GET" })
  .middleware([peopleMembersReadMiddleware])
  .validator(receiptsInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).listReceipts(data))

/** One receipt's PDF: the signed copy once there is one. */
export const downloadReceipt = createServerFn({ method: "GET" })
  .middleware([peopleMembersReadMiddleware])
  .validator(receiptInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).downloadReceipt(data))

/** A ZIP of the receipts waiting for the viewer's signature. */
export const downloadReceiptsToSign = createServerFn({ method: "POST" })
  .middleware([peopleReceiptsSignMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).downloadReceiptsToSign())

/** Reads signed files and matches them to receipts; nothing is saved or sent yet. */
export const previewSignedReceipts = createServerFn({ method: "POST" })
  .middleware([peopleReceiptsSignMiddleware])
  .validator((data: FormData) => {
    const files = data.getAll("files").filter((file): file is File => file instanceof File && file.size > 0)
    if (files.length === 0) throw new Error("Choose the signed files.")
    if (files.length > MAX_SIGNED_FILES) throw new Error(`Upload at most ${MAX_SIGNED_FILES} files at a time.`)
    const wrongType = files.find((file) => !SIGNED_EXTENSIONS.test(file.name))
    if (wrongType) throw new Error(`${wrongType.name} isn't a PDF or .p7m file.`)
    const tooLarge = files.find((file) => file.size > SIGNED_MAX_SIZE)
    if (tooLarge) throw new Error(`${tooLarge.name} is larger than 10 MB.`)
    if (files.reduce((total, file) => total + file.size, 0) > SIGNED_MAX_TOTAL) {
      throw new Error("Upload at most 50 MB at a time.")
    }
    if (files.some((file) => file.name.length > SIGNED_MAX_NAME)) {
      throw new Error(`File names can be at most ${SIGNED_MAX_NAME} characters.`)
    }
    return files
  })
  .handler(async ({ data, context }) => (await peopleApi(context)).previewSignedReceipts(data))

/** Saves the signed files on their receipts and emails each to its member. */
export const sendSignedReceipts = createServerFn({ method: "POST" })
  .middleware([peopleReceiptsSignMiddleware])
  .validator(sendSignedInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).sendSignedReceipts(data))

/** Creates or reuses durable eSign requests for these receipts; the backend fixes the PDF and the officer. */
export const prepareReceiptSignatures = createServerFn({ method: "POST" })
  .middleware([peopleReceiptsSignMiddleware, esignSignWriteMiddleware])
  .validator(prepareReceiptSignaturesInputSchema)
  .handler(async ({ data, context }) => {
    const signatures = await (await peopleApi(context)).prepareReceiptSignatures(data)
    if (
      signatures.length !== data.receiptIds.length ||
      signatures.some((item) => !data.receiptIds.includes(item.receiptId))
    ) {
      throw new Error("The signing requests do not match the selected receipts.")
    }
    return signatures
  })
