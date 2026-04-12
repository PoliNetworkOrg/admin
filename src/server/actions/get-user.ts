"use server"
import { trpc } from "../trpc"

export async function getUser(username: string) {
  const { user } = await trpc.tg.users.getByUsername.query({ username })
  if (!user) {
    return null
  }

  const { roles, groupAdmin } = await trpc.tg.permissions.getRoles.query({ userId: user.id })
  const { messages } = await trpc.tg.messages.getLastByUser.query({ userId: user.id, limit: 15 })
  const audit = await trpc.tg.auditLog.getById.query({ targetId: user.id })

  return { roles, groupAdmin, user, messages, audits: audit }
}
