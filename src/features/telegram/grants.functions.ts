import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { adminMiddleware } from "@/server/auth.middleware"

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

export const createTelegramGrant = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(grantInput)
  .handler(({ data, context }) =>
    context.backend.tg.grants.create.mutate({
      ...data,
      adderId: context.telegramId,
      sendTgLog: true,
    })
  )

export const interruptTelegramGrant = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(({ data, context }) =>
    context.backend.tg.grants.interrupt.mutate({
      userId: data.userId,
      interruptedById: context.telegramId,
      sendTgLog: true,
    })
  )
