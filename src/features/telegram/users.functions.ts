import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import type { TgUser } from "@/lib/api/types"
import { adminMiddleware } from "@/server/auth.middleware"
import { hasPermission } from "@/server/permissions"

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

      if (response.error) {
        console.error(response.error)
        if (response.error === "NOT_FOUND") return { user: null, status: "not-found" }
        return { user: null, status: "error", message: "Telegram user lookup failed." }
      }
      if (!response.user) return { user: null, status: "not-found" }
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

/**
 * A Telegram user with the sections the signed-in admin may read: each needs its own permission in the backend
 * (`tg:messages:read`, `tg:audit:read`, `tg:grants:read`), and a section without it is `null`.
 */
export const getTelegramUserDetails = createServerFn()
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const { backend, permissions } = context
    const { user } = await backend.tg.users.get.query({ userId: data.userId })
    if (!user) throw notFound()

    const canReadGrants = hasPermission(permissions, "tg:grants:read")
    const [messages, audits, ongoingGrant, scheduledGrants] = await Promise.all([
      hasPermission(permissions, "tg:messages:read")
        ? backend.tg.messages.getLastByUser.query({ userId: user.id, limit: 15 })
        : null,
      hasPermission(permissions, "tg:audit:read") ? backend.tg.auditLog.getById.query({ targetId: user.id }) : null,
      canReadGrants ? backend.tg.grants.checkUser.query({ userId: user.id }) : null,
      canReadGrants ? backend.tg.grants.getScheduled.query() : null,
    ])

    return {
      user,
      messages: messages ? (messages.messages ?? []) : null,
      audits,
      grants:
        ongoingGrant && scheduledGrants
          ? {
              ongoing: ongoingGrant.grant ?? null,
              scheduled: scheduledGrants.grants
                .filter((record) => record.grant.userId === user.id)
                .map((record) => record.grant)
                .sort((left, right) => left.validSince.getTime() - right.validSince.getTime()),
            }
          : null,
    }
  })
