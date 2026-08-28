import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

import { createGroupLabelInput, editGroupLabelInput, groupLabelIdentifierInput } from "./group-labels.validation"

export const listGroupLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.tg.groupLabels.getAll.query())

export const createGroupLabel = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
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
  .middleware([writeAdminMiddleware])
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

export const deleteGroupLabel = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(groupLabelIdentifierInput)
  .handler(async ({ data, context }) => {
    await context.backend.tg.groupLabels.delete.mutate({ label: data.label })
    return { error: null }
  })
