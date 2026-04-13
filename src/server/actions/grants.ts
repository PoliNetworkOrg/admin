"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function getUserGrant(userId: number) {
  return await trpc.tg.grants.checkUser.query({ userId })
}

export async function createGrant(input: Omit<ApiInput["tg"]["grants"]["create"], "adderId" | "sendTgLog">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { success: false, error: "UNAUTHORIZED" }

  return await trpc.tg.grants.create.mutate({ ...input, adderId: telegramId, sendTgLog: true })
}

export async function interruptGrant(userId: number) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed)
    return {
      success: false,
      error: "UNAUTHORIZED",
    }

  return await trpc.tg.grants.interrupt.mutate({ userId, interruptedById: telegramId, sendTgLog: true })
}
