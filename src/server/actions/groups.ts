"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"

export async function searchGroup(query: string) {
  return trpc.tg.groups.search.query({ query, limit: 20, showHidden: true })
}

export async function setGroupHide(groupId: number, hide: boolean) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return false

  return trpc.tg.groups.setHide.mutate({ telegramId: groupId, hide })
}
