import type { StatusTone } from "@/components/primitives/status-badge"
import type { AuditArea, AuditEvent, AuditOutcome } from "@/lib/api/types"

export const AREA_LABEL = {
  tg: "Telegram",
  wa: "WhatsApp",
  web: "Web",
  groups: "Labels",
  azure: "Microsoft 365",
  esign: "Signatures",
  auth: "Accounts",
} satisfies Record<AuditArea, string>

export const OUTCOME = {
  success: { label: "Done", tone: "success" },
  failure: { label: "Failed", tone: "danger" },
  denied: { label: "Denied", tone: "warning" },
} satisfies Record<AuditOutcome, { label: string; tone: StatusTone }>

const ACTIONS = new Map([
  ["tg.moderation.ban", "Banned"],
  ["tg.moderation.unban", "Unbanned"],
  ["tg.moderation.kick", "Kicked"],
  ["tg.moderation.mute", "Muted"],
  ["tg.moderation.unmute", "Unmuted"],
  ["tg.moderation.ban_all", "Banned from every group"],
  ["tg.moderation.unban_all", "Unbanned from every group"],
  ["tg.grants.create", "Created grant"],
  ["tg.grants.interrupt", "Interrupted grant"],
  ["tg.groups.create", "Synced groups"],
  ["tg.groups.delete", "Removed group"],
  ["tg.groups.setHide", "Changed group visibility"],
  ["tg.groups.leaveChat", "Left group"],
  ["tg.permissions.addRole", "Added role"],
  ["tg.permissions.removeRole", "Removed role"],
  ["tg.permissions.addGroup", "Made group admin"],
  ["tg.permissions.removeGroup", "Removed group admin"],
  ["wa.groups.add", "Added group"],
  ["wa.groups.modify", "Edited group"],
  ["wa.groups.delete", "Deleted group"],
  ["wa.groups.setHide", "Changed group visibility"],
  ["web.faqs.addFaqs", "Added FAQ"],
  ["web.faqs.addFaqsCategory", "Added FAQ category"],
  ["web.faqs.editFaqs", "Edited FAQ"],
  ["web.faqs.editFaqsCategory", "Edited FAQ category"],
  ["web.faqs.deleteFaqs", "Deleted FAQ"],
  ["web.faqs.deleteFaqsCategory", "Deleted FAQ category"],
  ["web.projects.addProject", "Added project"],
  ["web.projects.editProject", "Edited project"],
  ["web.projects.reorderProjects", "Reordered projects"],
  ["web.projects.deleteProject", "Deleted project"],
  ["web.associations.addAssociation", "Added association"],
  ["web.associations.editAssociation", "Edited association"],
  ["web.associations.editAssociationLinks", "Edited association links"],
  ["web.associations.deleteAssociation", "Deleted association"],
  ["web.guides_matricole.addGuide", "Added freshman guide"],
  ["web.guides_matricole.deleteGuide", "Deleted freshman guide"],
  ["web.reports.create", "Reported group"],
  ["web.reports.resolve", "Resolved reports"],
  ["web.reports.dismiss", "Dismissed reports"],
  ["groups.labels.create", "Created label"],
  ["groups.labels.modify", "Edited label"],
  ["groups.labels.delete", "Deleted label"],
  ["groups.labels.tagGroup", "Labelled group"],
  ["groups.labels.untagGroup", "Unlabelled group"],
  ["azure.members.create", "Created member"],
  ["azure.members.setAssocNumber", "Set member number"],
  ["azure.groups.addMember", "Added group member"],
  ["azure.groups.removeMember", "Removed group member"],
  ["esign.signers.resetIdentity", "Reset signer's CIE"],
  ["esign.drive.setAccess", "Changed drive access"],
  ["esign.documents.upload", "Uploaded document"],
  ["esign.documents.fromDrive", "Picked document from drive"],
  ["esign.requests.create", "Created signature request"],
  ["esign.requests.cancel", "Cancelled signature request"],
  ["esign.requests.delete", "Deleted signature request"],
  ["esign.requests.decline", "Declined signature request"],
  ["esign.requests.uploadSigned", "Uploaded signed document"],
  ["esign.requests.retryDelivery", "Retried delivery"],
  ["esign.jobs.create", "Started signature"],
  ["esign.jobs.cancel", "Cancelled signature"],
  ["auth.updateProfilePic", "Changed profile picture"],
])

const TARGET_TYPES = new Map([
  ["tg.user", "Telegram user"],
  ["tg.group", "Telegram group"],
  ["wa.group", "WhatsApp group"],
  ["web.faq", "FAQ"],
  ["web.faqCategory", "FAQ category"],
  ["web.project", "Project"],
  ["web.projects", "Projects"],
  ["web.association", "Association"],
  ["web.guide", "Freshman guide"],
  ["web.report", "Report"],
  ["groups.label", "Label"],
  ["azure.member", "Member"],
  ["azure.group", "Microsoft 365 group"],
  ["esign.signer", "Signer"],
  ["esign.drive", "Drive"],
  ["esign.document", "Document"],
  ["esign.request", "Signature request"],
  ["auth.user", "Account"],
])

/** "Edited FAQ"; actions without a name ("tg.groupLabels.create", the legacy mount) read from their path. */
export function actionLabel(action: string) {
  const known = ACTIONS.get(action) ?? ACTIONS.get(action.replace(/^tg\.groupLabels\./, "groups.labels."))
  if (known) return known
  const words = (action.split(".").at(-1) ?? action)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function isArea(value: string): value is AuditArea {
  return Object.hasOwn(AREA_LABEL, value)
}

/** Where the change was made: "Telegram" for `tg.grants.create`. */
export function areaLabel(action: string) {
  const area = action.split(".")[0] ?? action
  return isArea(area) ? AREA_LABEL[area] : area
}

export function targetTypeLabel(type: string) {
  return TARGET_TYPES.get(type) ?? type
}

/** The target's name, else its type and ID ("Telegram user 5021007919"); null when the event names no target. */
export function targetName(event: AuditEvent) {
  if (event.targetType === null) return null
  return event.targetLabel ?? `${targetTypeLabel(event.targetType)} ${event.targetId ?? ""}`.trim()
}

/** Who acted: their name, else what identifies them. */
export function actorName(event: AuditEvent) {
  if (event.actorName) return event.actorName
  if (event.actorKind === "service") return event.actorClient ?? "A service"
  if (event.actorTgId !== null) return `User ${event.actorTgId}`
  return event.actorSub ?? (event.actorKind === "legacy" ? "Unidentified legacy caller" : "Unknown")
}

/** How they acted: through which client, or the legacy path. */
export function actorVia(event: AuditEvent) {
  if (event.actorKind === "legacy") return "Legacy call without a token"
  if (event.actorKind === "telegram") return `On Telegram, through ${event.actorClient ?? "the bot"}`
  if (event.actorKind === "service") return "Service"
  return event.actorClient === "admin-dashboard" ? "Dashboard" : (event.actorClient ?? null)
}
