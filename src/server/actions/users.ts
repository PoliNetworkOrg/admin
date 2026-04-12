"use server"
import { trpc } from "../trpc"
import type { TgUserRole } from "../trpc/types"

export async function getUserInfo(userId: number) {
  return (await trpc.tg.users.get.query({ userId })).user ?? null
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

  return { roles, groupAdmin, user, messages, audits }
}

export async function addGroupAdmin(userId: number, groupId: number, adderId: number) {
  await trpc.tg.permissions.addGroup.mutate({ userId, adderId, groupId })
}

export async function delGroupAdmin(userId: number, groupId: number, removerId: number) {
  await trpc.tg.permissions.removeGroup.mutate({ userId, removerId, groupId })
}

export async function addUserRole(userId: number, role: TgUserRole, adderId: number) {
  await trpc.tg.permissions.addRole.mutate({ userId, role, adderId })
}

export async function delUserRole(userId: number, role: TgUserRole, removerId: number) {
  await trpc.tg.permissions.removeRole.mutate({ userId, role, removerId })
}
