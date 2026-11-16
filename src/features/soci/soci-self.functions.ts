import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from "./soci-fees"
import { sociApi } from "./soci.api.server"
import { completeDetailsInputSchema, receiptInputSchema } from "./soci.contract"

/**
 * Account › My area's Socio card: the signed-in account's socio record, found by its Microsoft 365 object ID, or `null`
 * when it isn't a socio's. With `people:self`, which the Socio role gives, and no `admin:access`.
 */
export const getMySocio = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await sociApi(context)).me.get())

const receiptFormSchema = receiptInputSchema.extend({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "The file is empty.")
    .refine((file) => file.size <= MAX_RECEIPT_BYTES, "The file is larger than 10 MB.")
    .refine((file) => RECEIPT_TYPES.some((type) => type === file.type), "Upload a PDF, JPEG or PNG."),
})

/** The form My area sends: the file, the transfer date and the declared amount in cents. */
export function parseReceiptForm(form: FormData) {
  return receiptFormSchema.parse({
    file: form.get("file"),
    transferDate: form.get("transferDate"),
    declaredCents: form.get("declaredCents"),
  })
}

/** This fee year's transfer receipt, replacing one still waiting for review. The backend checks the file's content. */
export const uploadMyReceipt = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator((form: FormData) => parseReceiptForm(form))
  .handler(async ({ data, context }) => (await sociApi(context)).me.uploadReceipt(data))

/** The socio's own empty fields; anything already recorded only the Direttivo changes. */
export const completeMyDetails = createServerFn({ method: "POST" })
  .middleware([peopleSelfMiddleware])
  .validator(completeDetailsInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).me.completeDetails(data))
