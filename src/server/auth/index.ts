import { headers } from "next/headers"
import { getSession } from "@/lib/auth"
import { trpc } from "../trpc"
import type { TgUserRole } from "../trpc/types"

export const getServerSession = async () => {
  const session = await getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })
  // console.log(session);
  return session
}

export async function requireRole(allowedRoles: TgUserRole[]) {
  const session = await getServerSession()
  const telegramId = session.data?.user.telegramId
  if (!telegramId) return { allowed: false, telegramId: 0 }

  const { roles } = await trpc.tg.permissions.getRoles.query({ userId: telegramId })
  return { allowed: roles?.some((s) => allowedRoles.includes(s)), telegramId }
}
