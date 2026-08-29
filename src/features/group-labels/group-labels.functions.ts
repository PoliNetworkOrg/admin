import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webWriteAdminMiddleware } from "@/server/auth.middleware"

import {
  createGroupLabelInput,
  editGroupLabelInput,
  groupLabelIdentifierInput,
  renameGroupLabelInput,
} from "./group-labels.validation"

export const listGroupLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groupLabels.getAll.query())

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

/**
 * TODO: the backend doesn't support renaming a label yet (`label` is the primary key, and `tg.groupLabels` has
 * no `rename` procedure) — this call will fail until that lands. The UI is ready for when it does.
 */
export const renameGroupLabel = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(renameGroupLabelInput)
  .handler(async ({ data, context }) => {
    const [renamed] = await context.backend.tg.groupLabels.rename.mutate({
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
