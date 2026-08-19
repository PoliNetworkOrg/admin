import type { ApiOutput, TgGrant, TgUser, TgUserRole } from "@/lib/api/types"

export type TelegramUserDetail = {
  user: TgUser
  roles: NonNullable<ApiOutput["tg"]["permissions"]["getRoles"]["roles"]>
  configuredRoles: TgUserRole[]
  groupAdmin: ApiOutput["tg"]["permissions"]["getRoles"]["groupAdmin"]
  groups: ApiOutput["tg"]["groups"]["getAll"]
  messages: NonNullable<ApiOutput["tg"]["messages"]["getLastByUser"]["messages"]>
  audits: ApiOutput["tg"]["auditLog"]["getById"]
  ongoingGrant: TgGrant | null
  scheduledGrants: TgGrant[]
}
