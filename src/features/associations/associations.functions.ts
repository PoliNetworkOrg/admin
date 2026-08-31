import { createServerFn } from "@tanstack/react-start"

import { webAdminMiddleware, webWriteAdminMiddleware } from "@/server/auth.middleware"

import {
  associationIdInput,
  associationLinksInput,
  parseCreateAssociationForm,
  parseEditAssociationForm,
} from "./associations.validation"

export const getAssociations = createServerFn()
  .middleware([webAdminMiddleware])
  .handler(({ context }) => context.backend.web.associations.getAllAssociations.query())

function associationFormData(data: ReturnType<typeof parseCreateAssociationForm>) {
  const formData = new FormData()
  formData.set("name", data.name)
  formData.set("descriptionIt", data.descriptionIt)
  formData.set("descriptionEn", data.descriptionEn)
  if (data.logo instanceof File) formData.set("logo", data.logo)
  return formData
}

export const createAssociation = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(parseCreateAssociationForm)
  .handler(async ({ data, context }) => {
    const formData = associationFormData(data)
    formData.set("createdBy", String(context.telegramId))
    return context.backend.web.associations.addAssociation.mutate(formData)
  })

export const editAssociation = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(parseEditAssociationForm)
  .handler(async ({ data, context }) => {
    const formData = associationFormData(data)
    formData.set("id", String(data.id))
    formData.set("modifiedBy", String(context.telegramId))
    const result = await context.backend.web.associations.editAssociation.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const editAssociationLinks = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(associationLinksInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.associations.editAssociationLinks.mutate({
      ...data,
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteAssociation = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(associationIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.associations.deleteAssociation.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
