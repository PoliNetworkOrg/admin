import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { esignReadMiddleware, esignSignWriteMiddleware } from "@/server/auth.middleware"

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

export const getEsignRequest = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data, context }) => {
    const [config, detail] = await Promise.all([
      context.backend.esign.config.query(),
      context.backend.esign.requests.get.query({ id: data.id }),
    ])
    const document = detail.currentDocumentId
      ? await context.backend.esign.documents.get.query({ documentId: detail.currentDocumentId })
      : null
    const events = detail.events.map((event) => {
      const parsed = eventData.safeParse(event.data ?? {})
      return { ...event, data: parsed.success ? parsed.data : {} }
    })
    return { config, ...detail, events, pdf: document?.pdf ?? null, me: context.user.sub }
  })

/** The PDF bytes of a document version, base64-encoded, for the viewer and downloads. */
export const getEsignDocumentContent = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ documentId: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.documents.content.query(data))

export const getEsignJobStatus = createServerFn()
  .middleware([esignReadMiddleware])
  .validator(z.object({ jobId: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.jobs.status.query(data))

/** Starts the caller's signature: returns the single-use ticket the agent's page needs. */
export const startEsignSignature = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(z.object({ requestId: z.uuid(), placement: placement.optional() }))
  .handler(({ data, context }) => context.backend.esign.jobs.create.mutate(data))

export const cancelEsignSignature = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(z.object({ jobId: z.uuid() }))
  .handler(({ data, context }) => context.backend.esign.jobs.cancel.mutate(data))

export const declineEsignRequest = createServerFn({ method: "POST" })
  .middleware([esignSignWriteMiddleware])
  .validator(z.object({ id: z.uuid(), reason: z.string().trim().max(500).nullable() }))
  .handler(({ data, context }) => context.backend.esign.requests.decline.mutate(data))
