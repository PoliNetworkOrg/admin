"use server"
import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

type AssociationFields = {
  name: string
  descriptionIt: string
  descriptionEn: string
  logoFile: File | null
}

function getAssociationFormData(input: AssociationFields) {
  const formData = new FormData()
  formData.set("name", input.name)
  formData.set("descriptionIt", input.descriptionIt)
  formData.set("descriptionEn", input.descriptionEn)
  if (input.logoFile) formData.set("logo", input.logoFile)
  return formData
}

export async function createAssociation(input: AssociationFields) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { association: null, error: "UNAUTHORIZED" }

  const formdata = getAssociationFormData(input)
  formdata.set("createdBy", String(telegramId))

  return {
    association: await trpc.web.associations.addAssociation.mutate(formdata),
    error: null,
  }
}

export async function editAssociation(input: AssociationFields & { id: number }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { association: null, error: "UNAUTHORIZED" }

  const formdata = getAssociationFormData(input)
  formdata.set("id", String(input.id))
  formdata.set("modifiedBy", String(telegramId))

  const result = await trpc.web.associations.editAssociation.mutate(formdata)
  if ("error" in result) return { association: null, error: result.error }

  return { association: result, error: null }
}

export async function editAssociationLinks({
  id,
  links,
}: Pick<ApiInput["web"]["associations"]["editAssociationLinks"], "id" | "links">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { association: null, error: "UNAUTHORIZED" }

  const result = await trpc.web.associations.editAssociationLinks.mutate({ id, links, modifiedBy: telegramId })
  if ("error" in result) return { association: null, error: result.error }

  return { association: result, error: null }
}

export async function deleteAssociation(id: number) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.web.associations.deleteAssociation.mutate({ id })
}
