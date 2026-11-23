import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, telegramGroupsWriteMiddleware } from "@/server/auth.middleware"

export const getTelegramGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groups.getAll.query())

export const telegramGroupVisibilityInput = z.object({ telegramId: z.number().int(), hide: z.boolean() })
export const telegramGroupChatInput = z.object({ chatId: z.number().int() })

export const setGroupVisibility = createServerFn({ method: "POST" })
  .middleware([telegramGroupsWriteMiddleware])
  .validator(telegramGroupVisibilityInput)
  .handler(async ({ data, context }) => {
    const updated = await context.backend.tg.groups.setHide.mutate(data)
    if (!updated) throw new Error("GROUP_VISIBILITY_NOT_UPDATED")
    return { updated: true as const }
  })

export const leaveTelegramGroup = createServerFn({ method: "POST" })
  .middleware([telegramGroupsWriteMiddleware])
  .validator(telegramGroupChatInput)
  // The backend takes the performer from the access token.
  .handler(({ data, context }) => context.backend.tg.groups.leaveChat.mutate({ chatId: data.chatId }))
