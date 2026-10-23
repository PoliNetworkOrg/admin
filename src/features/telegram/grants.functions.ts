import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, grantsWriteMiddleware } from "@/server/auth.middleware"

/** The grants page: ongoing and scheduled grants. The grantor is an IdP subject (`grantedBySub`). */
export const getTelegramGrants = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const [ongoing, scheduled] = await Promise.all([
      context.backend.tg.grants.getOngoing.query(),
      context.backend.tg.grants.getScheduled.query(),
    ])
    return { ongoing, scheduled }
  })

const grantInput = z
  .object({
    userId: z.number().int().positive(),
    since: z.date(),
    until: z.date(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(({ since, until }) => until > since, { message: "The grant end must be after its start.", path: ["until"] })

// The backend takes the author from the access token; actor fields are only read from legacy callers.
export const createTelegramGrant = createServerFn({ method: "POST" })
  .middleware([grantsWriteMiddleware])
  .validator(grantInput)
  .handler(({ data, context }) => context.backend.tg.grants.create.mutate({ ...data, sendTgLog: true }))

export const interruptTelegramGrant = createServerFn({ method: "POST" })
  .middleware([grantsWriteMiddleware])
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(({ data, context }) => context.backend.tg.grants.interrupt.mutate({ userId: data.userId, sendTgLog: true }))
