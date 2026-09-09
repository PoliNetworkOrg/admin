import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

import { addEmailTemplateInput, deleteEmailTemplateInput, editEmailTemplateInput } from "./email-templates.validation"

export const listEmailTemplates = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.email.templates.getAll.query())

export const addEmailTemplate = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(addEmailTemplateInput)
  .handler(({ data, context }) =>
    context.backend.email.templates.add.mutate({
      ...data,
      createdBy: context.telegramId,
    })
  )

export const editEmailTemplate = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(editEmailTemplateInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.email.templates.edit.mutate({
      ...data,
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(deleteEmailTemplateInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.email.templates.delete.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
