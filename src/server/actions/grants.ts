"use server"

import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function createGrant(input: ApiInput["tg"]["grants"]["create"]) {
  return await trpc.tg.grants.create.mutate(input)
}

export async function interruptGrant(input: ApiInput["tg"]["grants"]["interrupt"]) {
  return await trpc.tg.grants.interrupt.mutate(input)
}
