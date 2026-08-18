import { createServerFn } from "@tanstack/react-start"
import { adminMiddleware } from "@/server/auth.middleware"
import {
  associationIdInput,
  associationLinksInput,
  parseCreateAssociationForm,
  parseEditAssociationForm,
} from "./associations.validation"

export const getAssociations = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.associations.getAllAssociations.query())

async function serializeLogo(logo: string | File | null) {
  if (!(logo instanceof File)) return logo
  const contents = Buffer.from(await logo.arrayBuffer()).toString("base64")
  return `data:${logo.type};base64,${contents}`
}

export const createAssociation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(parseCreateAssociationForm)
  .handler(async ({ data, context }) =>
    context.backend.web.associations.addAssociation.mutate({
      name: data.name,
      descriptionIt: data.descriptionIt,
      descriptionEn: data.descriptionEn,
      logo: await serializeLogo(data.logo),
      createdBy: context.telegramId,
    })
  )

export const editAssociation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(parseEditAssociationForm)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.associations.editAssociation.mutate({
      id: data.id,
      name: data.name,
      descriptionIt: data.descriptionIt,
      descriptionEn: data.descriptionEn,
      logo: await serializeLogo(data.logo),
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const editAssociationLinks = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
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
  .middleware([adminMiddleware])
  .validator(associationIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.associations.deleteAssociation.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
