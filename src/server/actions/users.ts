"use server"
import { trpc } from "../trpc"

export async function searchUser(username: string) {
  const { user } = await trpc.tg.users.getByUsername.query({ username })
  if (!user) {
    return null
  }

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
