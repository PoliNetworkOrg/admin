"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function getAzureMembers() {
  return await trpc.azure.members.getAll.query()
}

export async function createAzureMember(input: ApiInput["azure"]["members"]["create"]) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.azure.members.create.mutate(input)
}

export async function setAzureMemberNumber(input: ApiInput["azure"]["members"]["setAssocNumber"]) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.azure.members.setAssocNumber.mutate(input)
}
