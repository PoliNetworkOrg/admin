import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { esignRequestsManageMiddleware } from "@/server/auth.middleware"
import type { BackendClient } from "@/server/backend.server"

const MAX_PDF_BYTES = 30 * 1024 * 1024

const placement = z.object({
  page: z.number().int().min(0),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
})

/**
 * The request a new one starts from, in any status, with its PDF as it was first added (its lowest version, before
 * anyone signed); `sourceError` instead when it doesn't exist or the caller can't see it.
 */
async function composerSource(backend: BackendClient, from: string) {
  const id = z.uuid().safeParse(from)
  if (!id.success) return { source: null, sourceError: "Couldn't load that request." }
  try {
    const { request, versions } = await backend.esign.requests.get.query({ id: id.data })
    const [original] = [...versions].sort((a, b) => a.version - b.version)
    if (original) return { source: { request, original }, sourceError: null }
  } catch (error) {
    console.error(error)
  }
  return { source: null, sourceError: "Couldn't load that request." }
}

/**
 * What a new request needs: dashboard users who can sign, and the shared drives (none without OneDrive). With `from`,
 * also the earlier request it starts from.
 */
export const getEsignComposer = createServerFn()
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ from: z.string().optional() }))
  .handler(async ({ data, context }) => {
    await context.backend.esign.profile.sync.mutate({ name: context.user.name, email: context.user.email || null })
    const [config, signers, from] = await Promise.all([
      context.backend.esign.config.query(),
      context.backend.esign.signers.list.query(),
      data.from ? composerSource(context.backend, data.from) : { source: null, sourceError: null },
    ])
    return { config, signers, me: context.user.sub, ...from }
  })

export const listEsignDrive = createServerFn()
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ driveId: z.string().min(1), folderId: z.string().min(1).optional() }))
  .handler(({ data, context }) => context.backend.esign.drive.list.query(data))

function parseUpload(data: FormData) {
  const file = data.get("file")
  if (!(file instanceof File)) throw new Error("Choose a PDF")
  if (file.size > MAX_PDF_BYTES) throw new Error("The PDF is larger than 30 MB")
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") throw new Error("Choose a PDF")
  return file
}

export const uploadEsignDocument = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(parseUpload)
  .handler(async ({ data, context }) => {
    const form = new FormData()
    form.set("file", data)
    return context.backend.esign.documents.upload.mutate(form)
  })

export const importEsignDriveDocument = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ driveId: z.string().min(1), itemId: z.string().min(1) }))
  .handler(({ data, context }) => context.backend.esign.documents.fromDrive.mutate(data))

export const createEsignRequest = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(1).max(200),
      documentId: z.uuid(),
      ordered: z.boolean(),
      signers: z
        .array(
          z.object({
            sub: z.string().min(1),
            role: z.string().trim().max(80).nullable(),
            places: z
              .array(placement.extend({ kind: z.enum(["signature", "mark"]) }))
              .min(1)
              .max(20),
          })
        )
        .min(1)
        .max(10),
      output: z
        .object({
          driveId: z.string().min(1),
          folderId: z.string().min(1),
          fileName: z.string().trim().min(1).max(200),
        })
        .nullable(),
      email: z.object({ to: z.array(z.email()).max(20), message: z.string().max(2000).nullable() }).nullable(),
    })
  )
  .handler(({ data, context }) => context.backend.esign.requests.create.mutate(data))

export const cancelEsignRequest = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.requests.cancel.mutate(data))

export const deleteEsignRequest = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.requests.delete.mutate(data))

export const retryEsignDelivery = createServerFn({ method: "POST" })
  .middleware([esignRequestsManageMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.requests.retryDelivery.mutate(data))
