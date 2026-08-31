import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { webAdminMiddleware, webWriteAdminMiddleware } from "@/server/auth.middleware"

import {
  createGroupLabelInput,
  editGroupLabelInput,
  groupLabelIdentifierInput,
  renameGroupLabelInput,
} from "./group-labels.validation"

export const listGroupLabels = createServerFn()
  .middleware([webAdminMiddleware])
  .handler(({ context }) => context.backend.tg.groupLabels.getAll.query())

/** All groups (Telegram + WhatsApp) with their labels already resolved. */
export const listGroupsWithLabels = createServerFn()
  .middleware([webAdminMiddleware])
  .handler(({ context }) => context.backend.groups.search.getAll.query())

/** Platform is required because Telegram and WhatsApp group IDs may collide. */
const groupLabelTagInput = z.object({
  groupId: z.number().int(),
  type: z.enum(["tg", "wa"]),
  label: z.string().min(1).max(128),
})

/** The web-only category view needs both platform lists without broadening their dashboard functions. */
export const listGroupsForLabels = createServerFn()
  .middleware([webAdminMiddleware])
  .handler(async ({ context }) => {
    const [tgGroups, waGroups] = await Promise.all([
      context.backend.tg.groups.getAll.query(),
      context.backend.wa.groups.getAll.query(),
    ])
    return { tgGroups, waGroups }
  })

export const tagGroup = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.groups.labels.tagGroup.mutate(data))

export const untagGroup = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.groups.labels.untagGroup.mutate(data))

export const createGroupLabel = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(createGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [created] = await context.backend.tg.groupLabels.create.mutate({
      label: data.label,
      description: data.description,
      color: data.color,
      createdBy: context.telegramId,
    })
    if (!created) throw new Error("The label could not be created.")
    return created
  })

export const editGroupLabel = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(editGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [updated] = await context.backend.tg.groupLabels.modify.mutate({
      label: data.label,
      description: data.description,
      color: data.color,
      updatedBy: context.telegramId,
    })
    if (!updated) throw new Error("NOT_FOUND")
    return updated
  })

export const renameGroupLabel = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(renameGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [renamed] = await context.backend.tg.groupLabels.modify.mutate({
      label: data.label,
      newLabel: data.newLabel,
      description: data.description,
      color: data.color,
      updatedBy: context.telegramId,
    })
    if (!renamed) throw new Error("NOT_FOUND")
    return renamed
  })

export const deleteGroupLabel = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(groupLabelIdentifierInput)
  .handler(async ({ data, context }) => {
    await context.backend.tg.groupLabels.delete.mutate({ label: data.label })
    return { error: null }
  })
