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

/** A grant's fields besides its dates. */
export const telegramGrantFields = {
  userId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
}

const telegramGrantInput = z
  .object({ ...telegramGrantFields, since: z.date(), until: z.date() })
  .refine(({ since, until }) => until > since, { message: "The grant end must be after its start.", path: ["until"] })

// The backend takes the author from the access token.
export const createTelegramGrant = createServerFn({ method: "POST" })
  .middleware([grantsWriteMiddleware])
  .validator(telegramGrantInput)
  .handler(({ data, context }) => context.backend.tg.grants.create.mutate({ ...data, sendTgLog: true }))

export const telegramGrantUserInput = z.object({ userId: z.number().int().positive() })

export const interruptTelegramGrant = createServerFn({ method: "POST" })
  .middleware([grantsWriteMiddleware])
  .validator(telegramGrantUserInput)
  .handler(({ data, context }) => context.backend.tg.grants.interrupt.mutate({ userId: data.userId, sendTgLog: true }))
