import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

/** How long the grants page waits for grantor names before showing their ids instead. */
const GRANTOR_LOOKUP_MS = 2000

/**
 * The grants page: both grant lists plus the users who authorized them, so "Authorized by" can show a name.
 * Grantors are looked up by id once the grants are in (one batched request, none without grants); they are
 * decoration, so a failed or slow lookup leaves the page with the grantor ids.
 */
export const getTelegramGrantsWithGrantors = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const [ongoing, scheduled] = await Promise.all([
      context.backend.tg.grants.getOngoing.query(),
      context.backend.tg.grants.getScheduled.query(),
    ])
    const grantorIds = new Set([...ongoing.grants, ...scheduled.grants].map(({ grant }) => grant.grantedBy))
    const signal = AbortSignal.timeout(GRANTOR_LOOKUP_MS)
    const lookups = await Promise.all(
      Array.from(grantorIds, (userId) =>
        context.backend.tg.users.get
          .query({ userId }, { signal })
          .then(({ user }) => user)
          .catch((error) => {
            console.error(error)
            return null
          })
      )
    )
    const grantors = lookups.filter((user) => user !== null && user !== undefined)
    return { ongoing, scheduled, grantors }
  })

const grantInput = z
  .object({
    userId: z.number().int().positive(),
    since: z.date(),
    until: z.date(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(({ since, until }) => until > since, { message: "The grant end must be after its start.", path: ["until"] })

export const createTelegramGrant = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(grantInput)
  .handler(({ data, context }) =>
    context.backend.tg.grants.create.mutate({
      ...data,
      adderId: context.telegramId,
      sendTgLog: true,
    })
  )

export const interruptTelegramGrant = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(({ data, context }) =>
    context.backend.tg.grants.interrupt.mutate({
      userId: data.userId,
      interruptedById: context.telegramId,
      sendTgLog: true,
    })
  )
