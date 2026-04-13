"use server"
import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiOutput, TgUserRole } from "../trpc/types"
import { getUserGrant } from "./grants"

export async function getUserInfo(userId: number) {
  return (await trpc.tg.users.get.query({ userId })).user ?? null
}

export async function getUserRoles(userId: number) {
  return await trpc.tg.permissions.getRoles.query({ userId })
}

export async function searchUserInfo(username: string) {
  return (await trpc.tg.users.getByUsername.query({ username })).user ?? null
}

export async function searchUser(username: string) {
  const user = await searchUserInfo(username)
  if (!user) return null

  const { roles, groupAdmin } = await trpc.tg.permissions.getRoles.query({ userId: user.id })
  const { messages } = await trpc.tg.messages.getLastByUser.query({ userId: user.id, limit: 15 })
  const audit = await trpc.tg.auditLog.getById.query({ targetId: user.id })

  const audits = await Promise.all(
    audit.map(async (audit) => ({
      ...audit,
      admin: await trpc.tg.users.get.query({ userId: audit.adminId }).catch(() => null),
    }))
  )

  const { grant } = await getUserGrant(user.id)
  return { roles, groupAdmin, user, messages, audits, grant }
}

export async function addGroupAdmin(userId: number, groupId: number) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  await trpc.tg.permissions.addGroup.mutate({ userId, adderId: telegramId, groupId })
  return { error: null }
}

export async function delGroupAdmin(
  userId: number,
  groupId: number
): Promise<ApiOutput["tg"]["permissions"]["removeGroup"]> {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.tg.permissions.removeGroup.mutate({ userId, removerId: telegramId, groupId })
}

export async function addUserRole(
  userId: number,
  role: TgUserRole
): Promise<ApiOutput["tg"]["permissions"]["addRole"]> {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { roles: null, error: "UNAUTHORIZED" }

  return await trpc.tg.permissions.addRole.mutate({ userId, role, adderId: telegramId })
}

export async function delUserRole(
  userId: number,
  role: TgUserRole
): Promise<ApiOutput["tg"]["permissions"]["removeRole"]> {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { roles: null, error: "UNAUTHORIZED" }

  return await trpc.tg.permissions.removeRole.mutate({ userId, role, removerId: telegramId })
}
