import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

/**
 * The grants page: both grant lists plus the users who authorized them, so "Authorized by" can show a name.
 * The users list is decoration here; when it fails the page still loads and shows the grantor ids.
 */
export const getTelegramGrantsWithGrantors = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const [ongoing, scheduled, users] = await Promise.all([
      context.backend.tg.grants.getOngoing.query(),
      context.backend.tg.grants.getScheduled.query(),
      context.backend.tg.users.getAll.query().catch((error) => {
        console.error(error)
        return null
      }),
    ])
    const grantorIds = new Set([...ongoing.grants, ...scheduled.grants].map(({ grant }) => grant.grantedBy))
    const grantors = (users?.users ?? []).filter((user) => grantorIds.has(user.id))
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
