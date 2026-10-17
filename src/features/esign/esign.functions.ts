import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { esignReadMiddleware, esignSignWriteMiddleware } from "@/server/auth.middleware"
import type { BackendClient } from "@/server/backend.server"

/** The audit payloads the backend writes; anything else is dropped. */
const eventData = z
  .object({
    sub: z.string(),
    name: z.string(),
    path: z.string(),
    to: z.array(z.string()),
    error: z.string(),
    reason: z.string().nullable(),
  })
  .partial()

const placement = z.object({
  page: z.number().int().min(0),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
})

/**
 * Everything the signature pages need first: the configuration and the caller's requests. Also refreshes the
 * caller's signer profile (name and email from the ID token), so managers can pick them as signers.
 */
export const getEsignHome = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ scope: z.enum(["inbox", "mine", "all"]) }))
  .handler(async ({ data, context }) => {
    await context.backend.esign.profile.sync.mutate({ name: context.user.name, email: context.user.email || null })
    const [config, requests] = await Promise.all([
      context.backend.esign.config.query(),
      context.backend.esign.requests.list.query({ scope: data.scope }),
    ])
    return { config, requests }
  })

/** How many requests wait for the caller's signature, for the navigation badge. */
export const getEsignPendingCount = createServerFn()
  .middleware([esignReadMiddleware])
  .handler(async ({ context }) => (await context.backend.esign.requests.list.query({ scope: "inbox" })).length)

/** A request with its audit trail and the pages and signatures of its current PDF. */
async function requestDetail(backend: BackendClient, id: string) {
  const detail = await backend.esign.requests.get.query({ id })
  const document = detail.currentDocumentId
    ? await backend.esign.documents.get.query({ documentId: detail.currentDocumentId })
    : null
  const events = detail.events.map((event) => {
    const parsed = eventData.safeParse(event.data ?? {})
    return { ...event, data: parsed.success ? parsed.data : {} }
  })
  return { ...detail, events, pdf: document?.pdf ?? null }
}

export const getEsignRequest = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data, context }) => {
    const [config, detail, inbox] = await Promise.all([
      context.backend.esign.config.query(),
      requestDetail(context.backend, data.id),
      context.backend.esign.requests.list.query({ scope: "inbox" }),
    ])
    /** Other documents waiting for the caller, which can be signed together with this one. */
    const alsoWaiting = inbox.filter((r) => r.myTurn && r.id !== data.id).length
    return { config, ...detail, me: context.user.sub, alsoWaiting }
  })

/** Documents signed together with one PIN, at most this many. */
export const MAX_BATCH = 10

/** The documents waiting for the caller's signature, in inbox order, for signing them together. */
export const getEsignBatch = createServerFn()
  .middleware([esignReadMiddleware])
  .handler(async ({ context }) => {
    const inbox = await context.backend.esign.requests.list.query({ scope: "inbox" })
    const waiting = inbox.filter((r) => r.myTurn)
    const items = await Promise.all(waiting.slice(0, MAX_BATCH).map((r) => requestDetail(context.backend, r.id)))
    return { items, more: Math.max(waiting.length - MAX_BATCH, 0), me: context.user.sub }
  })

/** The PDF bytes of a document version, base64-encoded, for the viewer and downloads. */
export const getEsignDocumentContent = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ documentId: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.documents.content.query(data))

const jobIds = z.object({ jobIds: z.array(z.uuid()).min(1).max(MAX_BATCH) })

export const getEsignJobStatus = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(jobIds)
  .handler(({ data, context }) => context.backend.esign.jobs.statuses.query(data))

/**
 * Starts the caller's signatures of one or more requests: returns a single-use ticket per request, all opened in one
 * agent window. `places` are the caller's boxes as they dragged them, one per place, in order.
 */
export const startEsignSignature = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(
    z.object({
      items: z
        .array(z.object({ requestId: z.uuid(), places: z.array(placement).max(20).optional() }))
        .min(1)
        .max(MAX_BATCH),
    })
  )
  .handler(({ data, context }) => context.backend.esign.jobs.create.mutate(data))

export const cancelEsignSignature = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(jobIds)
  .handler(({ data, context }) => context.backend.esign.jobs.cancel.mutate(data))

export const declineEsignRequest = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(z.object({ id: z.uuid(), reason: z.string().trim().max(500).nullable() }))
  .handler(({ data, context }) => context.backend.esign.requests.decline.mutate(data))

function parseSignedUpload(data: FormData) {
  const requestId = z.uuid().safeParse(data.get("requestId"))
  const file = data.get("file")
  if (!requestId.success) throw new Error("Unknown request")
  if (!(file instanceof File) || file.size > 30 * 1024 * 1024) throw new Error("Choose a PDF up to 30 MB")
  return { requestId: requestId.data, file }
}

/** The fallback when the agent can't run: a PDF the signer signed with the official CIE app. */
export const uploadSignedEsignDocument = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(parseSignedUpload)
  .handler(async ({ data, context }) => {
    const form = new FormData()
    form.set("requestId", data.requestId)
    form.set("file", data.file)
    return context.backend.esign.requests.uploadSigned.mutate(form)
  })
