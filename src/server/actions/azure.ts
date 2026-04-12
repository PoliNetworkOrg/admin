"use server"

import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function getAzureMembers() {
  return await trpc.azure.members.getAll.query()
}

export async function createAzureMember(input: ApiInput["azure"]["members"]["create"]) {
  return await trpc.azure.members.create.mutate(input)
}

export async function setAzureMemberNumber(input: ApiInput["azure"]["members"]["setAssocNumber"]) {
  return await trpc.azure.members.setAssocNumber.mutate(input)
}
