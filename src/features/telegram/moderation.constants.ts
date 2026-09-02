import type { ModerationAudit, ModerationAuditStatus, ModerationAuditType } from "./user-detail/types"

export const MODERATION_ACTION_LABELS = {
  ban: "Ban",
  unban: "Unban",
  kick: "Kick",
  mute: "Mute",
  unmute: "Unmute",
  delete: "Delete messages",
  multi_chat_spam: "Multi-chat spam",
  ban_all: "Ban all",
  unban_all: "Unban all",
} as const satisfies Record<ModerationAuditType, string>

export const MODERATION_STATUS_LABELS = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
} as const satisfies Record<ModerationAuditStatus, string>

export function moderationStatusBadgeVariant(
  status: ModerationAuditStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive"
  if (status === "pending" || status === "partial") return "outline"
  if (status === "running") return "secondary"
  return "default"
}

export function moderationUserName(
  user: ModerationAudit["admin"] | ModerationAudit["target"],
  fallbackId: number
): string {
  if (!user) return `Telegram user ${fallbackId}`
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || `Telegram user ${fallbackId}`
}

export function shouldShowDeletedMessageCount(audit: ModerationAudit): boolean {
  return (
    audit.deletedMessageCount === null ||
    audit.deletedMessageCount > 0 ||
    audit.type === "delete" ||
    audit.type === "ban_all" ||
    audit.type === "unban_all"
  )
}
