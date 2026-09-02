import { z } from "zod"

import type { ApiOutput, TgGrant, TgUser, TgUserRole } from "@/lib/api/types"

export const moderationAuditStatusSchema = z.enum(["pending", "running", "completed", "partial", "failed"])
export type ModerationAuditStatus = z.infer<typeof moderationAuditStatusSchema>

export const moderationAuditTypeSchema = z.enum([
  "ban",
  "unban",
  "kick",
  "mute",
  "unmute",
  "delete",
  "multi_chat_spam",
  "ban_all",
  "unban_all",
])
export type ModerationAuditType = z.infer<typeof moderationAuditTypeSchema>

type BackendMessage = NonNullable<ApiOutput["tg"]["messages"]["getLastByUser"]["messages"]>[number]

const moderationAuditUserSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string().optional(),
  username: z.string().optional(),
  isBot: z.boolean(),
  langCode: z.string().optional(),
})

export const moderationAuditSchema = z.object({
  id: z.number(),
  adminId: z.number(),
  targetId: z.number(),
  groupId: z.number().nullable(),
  type: moderationAuditTypeSchema,
  status: moderationAuditStatusSchema,
  until: z.date().nullable(),
  reason: z.string().nullable(),
  deletedMessageCount: z.number().nullable(),
  totalGroupCount: z.number(),
  successGroupCount: z.number(),
  failedGroupCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  groupTitle: z.string().optional(),
  admin: moderationAuditUserSchema.nullable(),
  target: moderationAuditUserSchema.nullable().optional(),
})
export type ModerationAudit = z.infer<typeof moderationAuditSchema>

export type TelegramMessage = BackendMessage & {
  deletedAt?: Date | string | null
}

export type TelegramUserDetail = {
  user: TgUser
  roles: NonNullable<ApiOutput["tg"]["permissions"]["getRoles"]["roles"]>
  configuredRoles: TgUserRole[]
  groupAdmin: ApiOutput["tg"]["permissions"]["getRoles"]["groupAdmin"]
  groups: ApiOutput["tg"]["groups"]["getAll"]
  messages: TelegramMessage[]
  audits: ModerationAudit[]
  ongoingGrant: TgGrant | null
  scheduledGrants: TgGrant[]
}
