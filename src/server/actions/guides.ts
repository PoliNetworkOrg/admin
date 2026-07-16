"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"

export async function getAllGuides() {
  return await trpc.web.guides_matricole.getAllGuides.query()
}

export async function createGuide(formData: FormData) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { guide: null, error: "UNAUTHORIZED" as const }

  formData.set("createdBy", String(telegramId))

  const result = await trpc.web.guides_matricole.addGuide.mutate(formData)
  if ("error" in result) return { guide: null, error: result.error }

  return { guide: result, error: null }
}

export async function deleteGuide(id: number) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" as const }

  return await trpc.web.guides_matricole.deleteGuide.mutate({ id })
}
