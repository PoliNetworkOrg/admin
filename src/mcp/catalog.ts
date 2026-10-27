import { z } from "zod"

import { associationLinksInput } from "../features/associations/associations.validation"
import { azureEmailSchema } from "../features/azure/email"
import * as faq from "../features/faqs/faqs.validation"
import * as freshman from "../features/freshman/freshman.validation"
import * as labels from "../features/group-labels/group-labels.validation"
import * as p from "../features/people/people.contract"
import { whatsappInviteLink } from "../features/whatsapp/whatsapp.validation"
import type { Permission } from "../server/permissions"

export type ToolDefinition = {
  path: string
  description: string
  method: "query" | "mutation"
  permissions: readonly Permission[]
  /** Self and team views also admit people:self without admin:access; the backend scopes the records. */
  self?: boolean
  team?: boolean
  destructive?: boolean
  input: z.ZodType
  output?: z.ZodType
  multipart?: boolean
}

const empty = z.object({}).strict()
const id = z.object({ id: z.number().int().positive() }).strict()
const uuid = z.object({ id: z.uuid() }).strict()
const userId = z.object({ userId: z.number().int().positive() }).strict()
const person = p.personRefInputSchema
const sign = ["esign:sign"] as const
const requests = ["esign:sign", "esign:requests:manage"] as const
const writeWeb = ["web:content:write"] as const

function read(
  path: string,
  description: string,
  input: z.ZodType = empty,
  permissions: readonly Permission[] = []
): ToolDefinition {
  return { path, description, method: "query", permissions, input }
}

function write(
  path: string,
  description: string,
  input: z.ZodType,
  permissions: readonly Permission[],
  destructive = false
): ToolDefinition {
  return { path, description, method: "mutation", permissions, input, destructive }
}

const file = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^/\\]+$/),
    type: z.string().min(1).max(100),
    base64: z
      .string()
      .max(40 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((value) => value.length % 4 === 0, "Use padded base64."),
  })
  .strict()

export const multipartInput = z
  .object({
    fields: z.record(z.string().max(100), z.string().max(20_000)).default({}),
    files: z.array(file.extend({ field: z.string().min(1).max(100) })).max(50),
  })
  .strict()

function upload(path: string, description: string, permissions: readonly Permission[]): ToolDefinition {
  return { ...write(path, description, multipartInput, permissions), multipart: true }
}

const tag = z.object({ groupId: z.number().int(), type: z.enum(["tg", "wa"]), label: z.string().min(1).max(128) })
const waFields = z.object({
  title: z.string().trim().min(1).max(200),
  link: whatsappInviteLink,
  hide: z.boolean().optional(),
})
const place = z.object({
  page: z.number().int().min(0),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
})
const jobs = z.object({ jobIds: z.array(z.uuid()).min(1).max(10) })
const accessRule = z.object({
  roles: z.array(z.string().regex(/^[A-Za-z0-9:._-]{1,100}$/)).max(50),
  permissions: z.array(z.string().regex(/^[A-Za-z0-9:._-]{1,100}$/)).max(50),
})

/** Explicit dashboard operations only. No arbitrary RPC, actor overrides, or Microsoft 365 membership edits. */
export const tools: ToolDefinition[] = [
  read("tg.groups.getAll", "List Telegram groups, including hidden groups."),
  write(
    "tg.groups.setHide",
    "Change one Telegram group's visibility.",
    z.object({ telegramId: z.number().int(), hide: z.boolean() }),
    ["tg:groups:manage"]
  ),
  write(
    "tg.groups.leaveChat",
    "Make the bot leave one Telegram group. Ask the person first.",
    z.object({ chatId: z.number().int() }),
    ["tg:groups:manage"],
    true
  ),
  read("tg.users.getAll", "List Telegram users.", empty, ["tg:users:read"]),
  read("tg.users.get", "Find a Telegram user by numeric ID.", userId, ["tg:users:read"]),
  read(
    "tg.users.getByUsername",
    "Find a Telegram user by username without @.",
    z.object({ username: z.string().trim().min(1).max(32) }),
    ["tg:users:read"]
  ),
  read("tg.users.getCreationHistory", "Read daily Telegram user counts.", empty, ["tg:users:read"]),
  read(
    "tg.messages.getLastByUser",
    "Read the latest messages of a Telegram user.",
    userId.extend({ limit: z.number().int().min(1).max(100).default(15) }),
    ["tg:messages:read"]
  ),
  read(
    "tg.auditLog.getById",
    "Read a Telegram user's audit trail.",
    z.object({ targetId: z.number().int().positive() }),
    ["tg:audit:read"]
  ),
  read("tg.grants.getOngoing", "List ongoing Telegram grants.", empty, ["tg:grants:read"]),
  read("tg.grants.getScheduled", "List scheduled Telegram grants.", empty, ["tg:grants:read"]),
  read("tg.grants.checkUser", "Read a Telegram user's ongoing grant.", userId, ["tg:grants:read"]),
  write(
    "tg.grants.create",
    "Create a Telegram grant. Dates are ISO timestamps; its author is the signed-in person.",
    userId
      .extend({
        since: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
        until: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
        reason: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.until > v.since, "End must follow start")
      .transform((v) => ({ ...v, sendTgLog: true })),
    ["tg:grants:manage"]
  ),
  write(
    "tg.grants.interrupt",
    "Interrupt one Telegram grant.",
    userId.transform((v) => ({ ...v, sendTgLog: true })),
    ["tg:grants:manage"],
    true
  ),
  read("wa.groups.getAll", "List WhatsApp groups, including hidden groups."),
  write("wa.groups.add", "Create a WhatsApp group entry.", waFields, ["wa:groups:manage"]),
  write("wa.groups.modify", "Edit one WhatsApp group entry.", waFields.extend({ id: z.number().int() }), [
    "wa:groups:manage",
  ]),
  write("wa.groups.delete", "Delete one WhatsApp group entry.", id, ["wa:groups:manage"], true),
  write("wa.groups.setHide", "Change one WhatsApp group's visibility.", id.extend({ hide: z.boolean() }), [
    "wa:groups:manage",
  ]),
  read("groups.labels.getAll", "List category, tag and publication labels."),
  read("groups.search.getAll", "List Telegram and WhatsApp groups with their labels."),
  write("groups.labels.tagGroup", "Add a label to one group.", tag, ["groups:labels:write"]),
  write("groups.labels.untagGroup", "Remove a label from one group.", tag, ["groups:labels:write"], true),
  write("groups.labels.create", "Create a category or tag.", labels.createGroupLabelInput, ["groups:labels:write"]),
  {
    ...write("groups.labels.create", "Create a publication label.", labels.createReleaseLabelInput, [
      "groups:labels:write",
    ]),
    path: "groups.labels.createRelease",
  },
  write("groups.labels.modify", "Edit a label's description and color.", labels.editGroupLabelInput, [
    "groups:labels:write",
  ]),
  {
    ...write(
      "groups.labels.modify",
      "Rename a label and its descendants. Confirm the full scope first.",
      labels.renameGroupLabelInput,
      ["groups:labels:write"],
      true
    ),
    path: "groups.labels.rename",
  },
  write(
    "groups.labels.delete",
    "Delete a label. Confirm the full scope, including descendants, first.",
    labels.groupLabelIdentifierInput,
    ["groups:labels:write"],
    true
  ),
  read("web.projects.getAllProjects", "List website projects."),
  upload(
    "web.projects.addProject",
    "Create a project. Multipart fields: title, descriptionIt, descriptionEn, link, category. Optional logo file (PNG/JPEG/SVG, 1 MB).",
    writeWeb
  ),
  upload("web.projects.editProject", "Edit a project. Same fields as creation, plus id. Optional logo file.", writeWeb),
  write("web.projects.deleteProject", "Delete one website project.", id, writeWeb, true),
  write(
    "web.projects.reorderProjects",
    "Set the project order using the complete ordered ID list.",
    z.object({ projectIds: z.array(z.number().int().positive()).min(1) }),
    writeWeb
  ),
  read("web.associations.getAllAssociations", "List website associations."),
  upload(
    "web.associations.addAssociation",
    "Create an association. Fields: name, descriptionIt, descriptionEn. Optional logo file (PNG/JPEG/SVG, 1 MB).",
    writeWeb
  ),
  upload("web.associations.editAssociation", "Edit an association. Same fields as creation, plus id.", writeWeb),
  write("web.associations.editAssociationLinks", "Edit one association's links.", associationLinksInput, writeWeb),
  write("web.associations.deleteAssociation", "Delete one website association.", id, writeWeb, true),
  read("web.faqs.getAllFaqs", "List FAQs and categories."),
  write("web.faqs.addFaqs", "Create a FAQ.", faq.addFAQInput, writeWeb),
  write("web.faqs.editFaqs", "Edit a FAQ.", faq.editFAQInput, writeWeb),
  write("web.faqs.deleteFaqs", "Delete one FAQ.", faq.deleteFAQInput, writeWeb, true),
  write(
    "web.faqs.addFaqsCategory",
    "Create a FAQ category.",
    faq.addFAQCategoryInput.transform((v) => ({ ...v, icon: v.icon ?? null })),
    writeWeb
  ),
  write(
    "web.faqs.editFaqsCategory",
    "Edit a FAQ category.",
    faq.editFAQCategoryInput.transform((v) => ({ ...v, icon: v.icon ?? null })),
    writeWeb
  ),
  write(
    "web.faqs.deleteFaqsCategory",
    "Delete one FAQ category. Check its FAQs before confirming.",
    faq.deleteFAQCategoryInput,
    writeWeb,
    true
  ),
  read("web.freshman.getContent", "Read the fixed Freshman website slots."),
  write("web.freshman.updateCard", "Edit a Freshman card.", freshman.updateFreshmanCardInput, writeWeb),
  write("web.freshman.moveCard", "Move a Freshman card one position.", freshman.moveFreshmanCardInput, writeWeb),
  write("web.freshman.selectFaq", "Select a FAQ for a Freshman slot.", freshman.selectFreshmanFaqInput, writeWeb),
  read("web.guides_matricole.getAllGuides", "List freshman guide editions."),
  upload(
    "web.guides_matricole.addGuide",
    "Create a guide edition. Fields: version, date (ISO timestamp); file: PDF up to 2 MB.",
    writeWeb
  ),
  write("web.guides_matricole.deleteGuide", "Delete one guide edition.", id, writeWeb, true),
  read(
    "web.reports.list",
    "List group-link reports.",
    z.object({ statuses: z.array(z.enum(["pending", "resolved", "dismissed"])).min(1) }),
    ["web:reports:manage"]
  ),
  write(
    "web.reports.resolve",
    "Resolve one report. Batch actions require explicit user instruction.",
    z.object({ ids: z.array(z.number().int()).length(1) }),
    ["web:reports:manage"]
  ),
  write(
    "web.reports.dismiss",
    "Dismiss one report.",
    z.object({ ids: z.array(z.number().int()).length(1) }),
    ["web:reports:manage"],
    true
  ),
  read("azure.members.getAll", "Read the Microsoft 365 member directory.", empty, ["azure:members:read"]),
  write(
    "azure.members.create",
    "Create a new member through the fixed workflow, including its welcome email. No existing group memberships can be edited.",
    z.object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      assocNumber: z.number().int().positive(),
      sendEmailTo: azureEmailSchema,
      mailbox: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("standard") }),
        z.object({ kind: z.literal("custom"), localPart: z.string().trim().min(1) }),
      ]),
    }),
    ["azure:members:create"]
  ),
  write(
    "azure.members.setAssocNumber",
    "Change one member's ID after confirmation; optionally email them. Duplicate IDs are refused by the backend.",
    z.object({
      userId: z.string().min(1),
      assocNumber: z.number().int().positive(),
      notifyEmail: azureEmailSchema.optional(),
    }),
    ["azure:members:write"]
  ),
  read("azure.groups.getAll", "Read Microsoft 365 groups and their members. Membership cannot be changed.", empty, [
    "azure:groups:read",
  ]),
  read("esign.config", "Read the CIE signing configuration.", empty, sign),
  read(
    "esign.requests.list",
    "List signing requests visible to the person.",
    z.object({ scope: z.enum(["inbox", "mine", "all"]) }),
    sign
  ),
  read("esign.requests.get", "Read a signing request, versions and audit trail.", uuid, sign),
  read(
    "esign.documents.get",
    "Read a document's pages and signature details.",
    z.object({ documentId: z.uuid() }),
    sign
  ),
  read("esign.documents.content", "Download a document's PDF as base64.", z.object({ documentId: z.uuid() }), sign),
  read("esign.jobs.statuses", "Read signing job status.", jobs, sign),
  write(
    "esign.jobs.create",
    "Prepare signatures and return single-use tickets. The person must finish in the existing CIE agent; never request a PIN here.",
    z.object({
      items: z
        .array(z.object({ requestId: z.uuid(), places: z.array(place).max(20).optional() }))
        .min(1)
        .max(10),
    }),
    sign
  ),
  write("esign.jobs.cancel", "Cancel one signing job.", z.object({ jobIds: z.array(z.uuid()).length(1) }), sign, true),
  write(
    "esign.requests.decline",
    "Decline one signing request.",
    uuid.extend({ reason: z.string().trim().max(500).nullable() }),
    sign,
    true
  ),
  read("esign.signers.list", "List available signers.", empty, requests),
  read(
    "esign.drive.list",
    "Browse an allowed shared drive.",
    z.object({ driveId: z.string().min(1), folderId: z.string().min(1).optional() }),
    requests
  ),
  upload("esign.documents.upload", "Upload a PDF up to 30 MB, file field: file.", requests),
  write(
    "esign.documents.fromDrive",
    "Import a document from an allowed shared drive.",
    z.object({ driveId: z.string().min(1), itemId: z.string().min(1) }),
    requests
  ),
  write(
    "esign.requests.create",
    "Create a signing request with fixed signers and PDF placements.",
    z.object({
      title: z.string().trim().min(1).max(200),
      documentId: z.uuid(),
      ordered: z.boolean(),
      signers: z
        .array(
          z.object({
            sub: z.string().min(1),
            role: z.string().trim().max(80).nullable(),
            places: z
              .array(place.extend({ kind: z.enum(["signature", "mark"]) }))
              .min(1)
              .max(20),
          })
        )
        .min(1)
        .max(10),
      output: z
        .object({
          driveId: z.string().min(1),
          folderId: z.string().min(1),
          fileName: z.string().trim().min(1).max(200),
        })
        .nullable(),
      email: z.object({ to: z.array(z.email()).max(20), message: z.string().max(2000).nullable() }).nullable(),
    }),
    requests
  ),
  write("esign.requests.cancel", "Cancel one signing request.", uuid, requests, true),
  write("esign.requests.delete", "Delete one signing request.", uuid, requests, true),
  write("esign.requests.retryDelivery", "Retry delivery without creating another request.", uuid, requests),
  read("esign.drive.access", "Read shared-drive access rules.", empty, ["esign:sign", "esign:drives:manage"]),
  write(
    "esign.drive.setAccess",
    "Change one drive's request and signing rules.",
    z.object({ driveId: z.string().min(1), request: accessRule, sign: accessRule }),
    ["esign:sign", "esign:drives:manage"]
  ),
]

function peopleRead(
  path: string,
  description: string,
  input: z.ZodType,
  output: z.ZodType,
  permission: Permission
): ToolDefinition {
  return { ...read(`people.${path}`, description, input, [permission]), output }
}

tools.push(
  peopleRead("persons.list", "List volunteer records.", empty, p.personRowSchema.array(), "people:read"),
  peopleRead(
    "persons.get",
    "Read one person's full record.",
    z.object({ id: p.personIdSchema }),
    p.personRecordSchema,
    "people:read"
  ),
  write("people.persons.create", "Create a person record.", p.createPersonInputSchema, ["people:write"]),
  write("people.persons.update", "Edit a person record.", p.updatePersonInputSchema, ["people:write"]),
  write("people.persons.setNote", "Set the HR note on one record.", p.setNoteInputSchema, ["people:write"]),
  peopleRead(
    "members.list",
    "Read the restricted member register.",
    empty,
    p.memberRegisterRowSchema.array(),
    "people:members:read"
  ),
  write("people.members.create", "Add a member to the register.", p.createMemberInputSchema, ["people:members:write"]),
  write("people.members.setStatus", "Change a member's status.", p.memberStatusInputSchema, ["people:members:write"]),
  write("people.members.setNumber", "Change a member's number.", p.memberNumberInputSchema, ["people:members:write"]),
  {
    ...write("people.members.export", "Export the register as CSV after confirmation.", empty, [
      "people:members:write",
    ]),
    output: p.exportResultSchema,
  },
  write("people.admins.end", "End one admin role.", p.endAdminInputSchema, ["people:write"], true),
  write(
    "people.admins.setCapoScope",
    "Appoint or change a Capo Admin, or end the role with scope=null.",
    p.capoScopeInputSchema,
    ["people:appoint"]
  ),
  write("people.admins.setCapoOfReference", "Set an admin's Capo Admin of reference.", p.capoRefInputSchema, [
    "people:write",
  ]),
  {
    ...peopleRead(
      "teams.list",
      "Read teams; Team Leads see their own teams.",
      empty,
      p.teamSummarySchema.array(),
      "people:read"
    ),
    team: true,
  },
  {
    ...peopleRead(
      "teams.candidates",
      "Read team candidates; backend scopes Team Lead access.",
      p.teamCandidatesInputSchema,
      p.teamCandidateSchema.array(),
      "people:read"
    ),
    team: true,
  },
  {
    ...write(
      "people.teams.addMember",
      "Add a team member. Appointing a Lead also requires people:appoint.",
      p.addTeamMemberInputSchema,
      ["people:write"]
    ),
    team: true,
  },
  {
    ...write("people.teams.updateFields", "Update team fields for an authorized team.", p.teamFieldsInputSchema, [
      "people:write",
    ]),
    team: true,
  },
  {
    ...write(
      "people.teams.endMembership",
      "End one team membership. Ending a Lead also requires people:appoint.",
      p.endTeamInputSchema,
      ["people:write"],
      true
    ),
    team: true,
  },
  peopleRead("census.campaigns", "List census campaigns.", empty, p.campaignSchema.array(), "people:read"),
  peopleRead(
    "census.campaign",
    "Read a census campaign.",
    z.object({ id: z.string().min(1).max(128) }),
    p.campaignDetailSchema,
    "people:read"
  ),
  peopleRead(
    "census.answers",
    "Read one person's census answers.",
    p.answersInputSchema,
    p.censusAnswersSchema,
    "people:read"
  ),
  write(
    "people.census.remind",
    "Send census reminders to one person or unanswered people; backend enforces the reminder interval.",
    p.remindInputSchema,
    ["people:write"]
  ),
  write("people.census.close", "Close one census campaign.", p.campaignInputSchema, ["people:write"], true),
  upload(
    "people.census.importPreview",
    "Preview a census import without saving. Fields: campaignId; file: UTF-8 CSV or XLSX up to 10 MB and 5,000 responses.",
    ["people:write"]
  ),
  write(
    "people.census.importCommit",
    "Apply an inspected census import with its reviewed choices.",
    p.importCommitInputSchema,
    ["people:write"]
  ),
  peopleRead("linking.reviews", "List account linking reviews.", empty, p.reviewSchema.array(), "people:read"),
  write("people.linking.resolve", "Resolve one account-linking review.", p.resolveReviewInputSchema, ["people:write"]),
  write("people.linking.dismiss", "Dismiss one account-linking review.", p.reviewInputSchema, ["people:write"], true),
  peopleRead("linking.invites", "List account invitations.", empty, p.inviteSchema.array(), "people:read"),
  write("people.linking.sendInvite", "Email an account invitation to one person.", person, ["people:write"]),
  write("people.linking.revokeInvite", "Revoke one account invitation.", person, ["people:write"], true),
  peopleRead(
    "linking.searchAccounts",
    "Search account matches for one person.",
    p.searchAccountsInputSchema,
    p.accountMatchSchema.array(),
    "people:write"
  ),
  write("people.linking.link", "Link an account after inspecting the match.", p.linkAccountInputSchema, [
    "people:write",
  ]),
  write("people.linking.unlink", "Unlink one person's account.", person, ["people:write"], true),
  peopleRead("fees.review", "Review a member's fee receipt.", person, p.feeReviewSchema, "people:fees:write"),
  peopleRead("fees.upload", "Download the fee upload as base64.", person, p.fileSchema, "people:fees:write"),
  write("people.fees.approve", "Approve one fee and issue its receipt.", person, ["people:fees:write"]),
  write("people.fees.reject", "Reject one fee upload with a reason.", p.rejectFeeInputSchema, ["people:fees:write"]),
  write("people.fees.markPaid", "Mark one fee paid and issue its receipt.", p.markPaidInputSchema, [
    "people:fees:write",
  ]),
  write(
    "people.fees.remind",
    "Send a fee reminder to one person, or all eligible people with personId=null.",
    p.feeRemindInputSchema,
    ["people:fees:write"]
  ),
  peopleRead(
    "receipts.list",
    "Read the receipts queue.",
    p.receiptsInputSchema,
    p.receiptsPageSchema,
    "people:members:read"
  ),
  peopleRead(
    "receipts.download",
    "Download one receipt as base64.",
    p.receiptInputSchema,
    p.fileSchema,
    "people:members:read"
  ),
  {
    ...write("people.receipts.toSign", "Download a ZIP of receipts waiting for the caller's signature.", empty, [
      "people:receipts:sign",
    ]),
    output: p.fileSchema,
  },
  upload(
    "people.receipts.previewSigned",
    "Match signed PDFs or P7M files to receipts without saving. File field: files, max 50 files, 10 MB each, 50 MB total.",
    ["people:receipts:sign"]
  ),
  write(
    "people.receipts.sendSigned",
    "Save reviewed signed files and email each receipt to its member.",
    p.sendSignedInputSchema,
    ["people:receipts:sign"]
  ),
  {
    ...write(
      "people.receipts.prepareSignatures",
      "Prepare durable CIE requests for selected receipts. Finish signing in the existing CIE UI.",
      p.prepareReceiptSignaturesInputSchema,
      ["people:receipts:sign", "esign:sign"]
    ),
    output: p.receiptSignaturesSchema,
  },
  write("people.receipts.retry", "Retry sending one receipt.", p.receiptInputSchema, ["people:fees:write"]),
  write(
    "people.receipts.void",
    "Void one receipt with a reason.",
    p.voidReceiptInputSchema,
    ["people:fees:write"],
    true
  )
)

const selfTools = [
  peopleRead("me.roles", "Read the caller's own People roles.", empty, p.myRolesSchema, "people:self"),
  peopleRead("me.get", "Read the caller's My area.", empty, p.myAreaSchema, "people:self"),
  write("people.me.confirmMatch", "Confirm the caller's first-sign-in account match.", empty, ["people:self"]),
  write("people.me.rejectMatch", "Reject the caller's proposed account match.", empty, ["people:self"]),
  write("people.me.acceptInvite", "Accept an invitation for the caller.", p.acceptInviteInputSchema, ["people:self"]),
  write("people.me.askToBeAdded", "Request the caller's volunteer record.", p.askToBeAddedInputSchema, ["people:self"]),
  write("people.me.answerCensus", "Submit the caller's census answer.", p.answerCensusInputSchema, ["people:self"]),
  write("people.me.requestCorrection", "Request an HR correction to the caller's record.", p.correctionInputSchema, [
    "people:self",
  ]),
  write("people.me.revokePhotoConsent", "Revoke the caller's photo consent.", empty, ["people:self"], true),
  upload(
    "people.me.uploadTransferReceipt",
    "Upload the caller's transfer receipt. Fields: transferDate, amountCents. File field: file, PDF/JPG/PNG up to 10 MB.",
    ["people:self"]
  ),
  peopleRead("me.receipt", "Download one of the caller's receipts.", p.receiptInputSchema, p.fileSchema, "people:self"),
  peopleRead(
    "capo.get",
    "Read the caller's Capo Admin area; backend checks the role and scope.",
    empty,
    p.capoAreaSchema,
    "people:self"
  ),
  write(
    "people.capo.approve",
    "Approve one request to join a group in the caller's Capo scope.",
    p.joinRequestInputSchema,
    ["people:self"]
  ),
  write(
    "people.capo.decline",
    "Decline one request to join a group in the caller's Capo scope.",
    p.joinRequestInputSchema,
    ["people:self"],
    true
  ),
]
tools.push(...selfTools.map((tool) => ({ ...tool, self: true })))

const peopleMutationOutputs = new Map<string, z.ZodType>([
  ["people.persons.create", p.createdSchema],
  ["people.members.export", p.exportResultSchema],
  ["people.census.remind", p.remindResultSchema],
  ["people.census.importPreview", p.importPreviewSchema],
  ["people.census.importCommit", p.importedSchema],
  ["people.fees.approve", p.issuedSchema],
  ["people.fees.markPaid", p.issuedSchema],
  ["people.fees.remind", p.remindResultSchema],
  ["people.receipts.previewSigned", p.signedUploadSchema],
  ["people.receipts.sendSigned", p.sendResultSchema],
])
for (const tool of tools) {
  const output = peopleMutationOutputs.get(tool.path)
  if (output) tool.output = output
}

/** Two named tools intentionally use the same backend procedure with different validated inputs. */
export function backendPath(tool: ToolDefinition) {
  if (tool.path === "groups.labels.createRelease") return "groups.labels.create"
  if (tool.path === "groups.labels.rename") return "groups.labels.modify"
  return tool.path
}

export function toolName(tool: ToolDefinition) {
  return tool.path.replaceAll(".", "_")
}

export function canUseTool(tool: ToolDefinition, permissions: readonly string[]) {
  if (tool.team && permissions.includes("people:self")) return true
  if (!tool.self && !permissions.includes("admin:access")) return false
  return tool.permissions.every((permission) => permissions.includes(permission))
}

export function rpcMethod(path: string) {
  if (path === "me.access") return "GET"
  // Internal display-profile sync, populated from the native client's verified ID token, never a model tool.
  if (path === "esign.profile.sync") return "POST"
  const tool = tools.find((item) => backendPath(item) === path)
  return tool ? (tool.method === "query" ? "GET" : "POST") : null
}
