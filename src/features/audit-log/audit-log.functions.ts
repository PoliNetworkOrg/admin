import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { auditReadMiddleware } from "@/server/auth.middleware"

export const AUDIT_AREAS = ["tg", "wa", "web", "groups", "azure", "esign", "auth"] as const
export const AUDIT_OUTCOMES = ["success", "failure", "denied"] as const

/** One page of the audit log, newest first; `cursor` is the previous page's `nextCursor`. */
export const getAuditEvents = createServerFn({ method: "GET" })
  .middleware([auditReadMiddleware])
  .validator(
    z.object({
      cursor: z.number().int().positive().optional(),
      area: z.enum(AUDIT_AREAS).optional(),
      outcome: z.enum(AUDIT_OUTCOMES).optional(),
      search: z.string().trim().max(100).optional(),
    })
  )
  .handler(({ data, context }) => context.backend.audit.list.query({ ...data, limit: 50 }))

/** One event by ID, for a link to an event older than the pages loaded; null when it does not exist. */
export const getAuditEvent = createServerFn({ method: "GET" })
  .middleware([auditReadMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    // The page before `id + 1` starts at `id`, if it exists.
    const { events } = await context.backend.audit.list.query({ cursor: data.id + 1, limit: 1 })
    const [event] = events
    return event?.id === data.id ? event : null
  })
