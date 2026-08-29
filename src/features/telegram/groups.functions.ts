import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

export const getTelegramGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groups.getAll.query())

export const getGroupLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groupLabels.getAll.query())

export const getGroupLabelRelations = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groupLabels.getAllRelations.query())

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

const createGroupInput = z.object({
  title: z.string().trim().min(1),
  telegramId: z.number().int(),
  tag: z.string().trim().optional(),
  link: z.url({ hostname: /^t\.me$/ }),
})

export const createTelegramGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(createGroupInput)
  .handler(async ({ data, context }) => {
    const [telegramId] = await context.backend.tg.groups.create.mutate([data])
    if (telegramId === undefined) throw new Error("GROUP_NOT_CREATED")
    return { telegramId }
  })

const groupLabelTagInput = z.object({ groupId: z.number().int(), label: z.string().min(1).max(128) })

export const tagTelegramGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.tg.groupLabels.tagGroup.mutate(data))

export const untagTelegramGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.tg.groupLabels.untagGroup.mutate(data))
