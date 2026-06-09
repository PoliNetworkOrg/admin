"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function createAssociation(input: Omit<ApiInput["web"]["associations"]["addAssociation"], "createdBy">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { association: null, error: "UNAUTHORIZED" }

  return {
    association: await trpc.web.associations.addAssociation.mutate({ ...input, createdBy: telegramId }),
    error: null,
  }
}

export async function editAssociation(input: Omit<ApiInput["web"]["associations"]["editAssociation"], "modifiedBy">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { association: null, error: "UNAUTHORIZED" }

  const result = await trpc.web.associations.editAssociation.mutate({ ...input, modifiedBy: telegramId })
  if ("error" in result) return { association: null, error: result.error }

  return { association: result, error: null }
}

export async function deleteAssociation(id: number) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.web.associations.deleteAssociation.mutate({ id })
}
