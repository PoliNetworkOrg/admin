import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, labelsWriteMiddleware } from "@/server/auth.middleware"

import {
  createGroupLabelInput,
  createReleaseLabelInput,
  editGroupLabelInput,
  groupLabelIdentifierInput,
  renameGroupLabelInput,
} from "./group-labels.validation"

export const listGroupLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.groups.labels.getAll.query())

/** All groups (Telegram + WhatsApp) with their labels already resolved. */
export const listGroupsWithLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.groups.search.getAll.query())

/** Platform is required because Telegram and WhatsApp group IDs may collide. */
const groupLabelTagInput = z.object({
  groupId: z.number().int(),
  type: z.enum(["tg", "wa"]),
  label: z.string().min(1).max(128),
})

/** The web-only category view needs both platform lists without broadening their dashboard functions. */
export const listGroupsForLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const [tgGroups, waGroups] = await Promise.all([
      context.backend.tg.groups.getAll.query(),
      context.backend.wa.groups.getAll.query(),
    ])
    return { tgGroups, waGroups }
  })

// Writes carry no author: the backend records it from the access token (`*_by_sub`).
export const tagGroup = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.groups.labels.tagGroup.mutate(data))

export const untagGroup = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(groupLabelTagInput)
  .handler(({ data, context }) => context.backend.groups.labels.untagGroup.mutate(data))

export const createGroupLabel = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(createGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [created] = await context.backend.groups.labels.create.mutate({
      label: data.label,
      description: data.description,
      color: data.color,
    })
    if (!created) throw new Error("The label could not be created.")
    return created
  })

export const createReleaseLabel = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(createReleaseLabelInput)
  .handler(async ({ data, context }) => {
    const [created] = await context.backend.groups.labels.create.mutate(data)
    if (!created) throw new Error("The publication could not be created.")
    return created
  })

export const editGroupLabel = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(editGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [updated] = await context.backend.groups.labels.modify.mutate({
      label: data.label,
      description: data.description,
      color: data.color,
    })
    if (!updated) throw new Error("NOT_FOUND")
    return updated
  })

export const renameGroupLabel = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(renameGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [renamed] = await context.backend.groups.labels.modify.mutate({
      label: data.label,
      newLabel: data.newLabel,
      description: data.description,
      color: data.color,
    })
    if (!renamed) throw new Error("NOT_FOUND")
    return renamed
  })

export const deleteGroupLabel = createServerFn({ method: "POST" })
  .middleware([labelsWriteMiddleware])
  .validator(groupLabelIdentifierInput)
  .handler(async ({ data, context }) => {
    await context.backend.groups.labels.delete.mutate({ label: data.label })
    return { error: null }
  })
