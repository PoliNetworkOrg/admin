import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

export const getTelegramGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groups.getAll.query())

export const setGroupVisibility = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ telegramId: z.number().int(), hide: z.boolean() }))
  .handler(async ({ data, context }) => {
    const updated = await context.backend.tg.groups.setHide.mutate(data)
    if (!updated) throw new Error("GROUP_VISIBILITY_NOT_UPDATED")
    return { updated: true as const }
  })

export const leaveTelegramGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ chatId: z.number().int() }))
  .handler(({ data, context }) =>
    context.backend.tg.groups.leaveChat.mutate({ chatId: data.chatId, performerId: context.telegramId })
  )
