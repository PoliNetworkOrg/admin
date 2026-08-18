import { USER_ROLE } from "@polinetwork/backend"
import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { TgUser, TgUserRole } from "@/lib/api/types"
import { adminMiddleware } from "@/server/auth.middleware"

export const getTelegramUsers = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const result = await context.backend.tg.users.getAll.query()
    if (result.error) throw new Error(result.error)
    return result.users ?? []
  })

const telegramUserLookupInput = z.discriminatedUnion("by", [
  z.object({ by: z.literal("username"), username: z.string().trim().min(1).max(32) }),
  z.object({ by: z.literal("id"), userId: z.number().int().positive() }),
])

type TelegramUserLookupResult = {
  user: TgUser | null
  status: "found" | "not-found" | "error"
  message?: string
}

export const findTelegramUser = createServerFn()
  .middleware([adminMiddleware])
  .validator(telegramUserLookupInput)
  .handler(async ({ data, context }): Promise<TelegramUserLookupResult> => {
    try {
      const response =
        data.by === "username"
          ? await context.backend.tg.users.getByUsername.query({ username: data.username.replace(/^@/, "") })
          : await context.backend.tg.users.get.query({ userId: data.userId })

      if (response.error === "NOT_FOUND" || !response.user) return { user: null, status: "not-found" }
      if (response.error) return { user: null, status: "error", message: "Telegram user lookup failed." }
      return { user: response.user, status: "found" }
    } catch (error) {
      console.error(error)
      return {
        user: null,
        status: "error",
        message: "The PoliNetwork backend is currently unavailable.",
      }
    }
  })

export const getTelegramUserDetails = createServerFn()
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const { user } = await context.backend.tg.users.get.query({ userId: data.userId })
    if (!user) throw notFound()

    const [permissions, messages, audits, ongoingGrant, scheduledGrants, groups] = await Promise.all([
      context.backend.tg.permissions.getRoles.query({ userId: user.id }),
      context.backend.tg.messages.getLastByUser.query({ userId: user.id, limit: 15 }),
      context.backend.tg.auditLog.getById.query({ targetId: user.id }),
      context.backend.tg.grants.checkUser.query({ userId: user.id }),
      context.backend.tg.grants.getScheduled.query(),
      context.backend.tg.groups.getAll.query(),
    ])
    const userScheduledGrants = scheduledGrants.grants
      .filter((record) => record.grant.userId === user.id)
      .map((record) => record.grant)
      .sort((left, right) => new Date(left.validSince).getTime() - new Date(right.validSince).getTime())

    return {
      user,
      roles: permissions.roles ?? [],
      configuredRoles: Object.values(USER_ROLE),
      groupAdmin: permissions.groupAdmin.filter((group) => group !== null),
      groups,
      messages: messages.messages ?? [],
      audits,
      ongoingGrant: ongoingGrant.grant ?? null,
      scheduledGrants: userScheduledGrants,
    }
  })

export const addTelegramGroupAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.number().int().positive(), groupId: z.number().int() }))
  .handler(({ data, context }) =>
    context.backend.tg.permissions.addGroup.mutate({ ...data, adderId: context.telegramId })
  )

export const removeTelegramGroupAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.number().int().positive(), groupId: z.number().int() }))
  .handler(({ data, context }) =>
    context.backend.tg.permissions.removeGroup.mutate({ ...data, removerId: context.telegramId })
  )

const telegramRoleValues = Object.values(USER_ROLE) as [TgUserRole, ...TgUserRole[]]
const telegramRoleInput = z.object({ userId: z.number().int().positive(), role: z.enum(telegramRoleValues) })

export const addTelegramUserRole = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(telegramRoleInput)
  .handler(({ data, context }) =>
    context.backend.tg.permissions.addRole.mutate({ ...data, adderId: context.telegramId })
  )

export const removeTelegramUserRole = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(telegramRoleInput)
  .handler(({ data, context }) =>
    context.backend.tg.permissions.removeRole.mutate({ ...data, removerId: context.telegramId })
  )
