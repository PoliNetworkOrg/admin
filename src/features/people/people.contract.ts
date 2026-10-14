import { z } from "zod"

/**
 * The `people.*` backend contract (docs/people/contract.md). The backend doesn't serve it yet: agent mode answers from
 * `people.fake.server.ts`, and real responses are parsed with these schemas before they reach a page.
 */

export const TEAM_IDS = ["it", "hr", "design", "intl", "events"] as const
export const CAMPUSES = ["Leonardo", "Bovisa", "Cremona", "Piacenza", "Mantova", "Lecco", "External"] as const
export const YEARS = ["1st year", "2nd year", "3rd year", "1st year MSc", "2nd year MSc", "Graduated"] as const
/** Politecnico di Milano courses offered in forms; the backend accepts any course name. */
export const COURSES = [
  "Ingegneria Informatica",
  "Computer Science and Engineering",
  "Ingegneria Gestionale",
  "Management Engineering",
  "Ingegneria Meccanica",
  "Ingegneria Aerospaziale",
  "Ingegneria Energetica",
  "Ingegneria Chimica",
  "Ingegneria Elettronica",
  "Ingegneria Biomedica",
  "Ingegneria Matematica",
  "Ingegneria Civile",
  "Design della Comunicazione",
  "Design del Prodotto Industriale",
  "Design degli Interni",
  "Architettura",
  "Urbanistica",
] as const
export const MEMBER_STATUSES = ["active", "suspended", "expired", "former"] as const
export const FEE_STATUSES = ["due", "receipt", "paid", "unpaid"] as const
export const ACCOUNT_STATUSES = ["none", "invite", "linked", "review"] as const
export const CENSUS_ANSWERS = ["continues", "leaving"] as const
export const REVIEW_KINDS = ["telegram-conflict", "ask-to-be-added", "two-records", "not-me", "name-only"] as const

export const teamIdSchema = z.enum(TEAM_IDS)
export const campusSchema = z.enum(CAMPUSES)
export const memberStatusSchema = z.enum(MEMBER_STATUSES)
export const feeStatusSchema = z.enum(FEE_STATUSES)
export const censusAnswerSchema = z.enum(CENSUS_ANSWERS)

export type TeamId = z.infer<typeof teamIdSchema>
export type Campus = z.infer<typeof campusSchema>
export type MemberStatus = z.infer<typeof memberStatusSchema>
export type FeeStatus = z.infer<typeof feeStatusSchema>
export type CensusAnswer = z.infer<typeof censusAnswerSchema>
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]
export type ReviewKind = (typeof REVIEW_KINDS)[number]

const personRefSchema = z.object({ id: z.string(), name: z.string() })
const groupSchema = z.object({ chatId: z.string(), title: z.string() })

export const profileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  /** `null` without contact rights. */
  personalEmail: z.string().nullable(),
  /** `null` without contact rights. */
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  telegramId: z.string().nullable(),
  course: z.string(),
  year: z.string(),
  campus: campusSchema,
  otherAssociations: z.array(z.string()),
  studentRepresentative: z.string().nullable(),
})

export const membershipSchema = z.object({
  number: z.string(),
  status: memberStatusSchema,
  admittedOn: z.string(),
  /** The current academic year's fee; `null` for former members. */
  fee: feeStatusSchema.nullable(),
  m365Email: z.string(),
})

export const adminRoleSchema = z.object({
  status: z.enum(["active", "former"]),
  since: z.string(),
  endedOn: z.string().nullable(),
  endReason: z.string().nullable(),
  /** Detected by the bot. */
  groups: z.array(groupSchema),
  requested: z.array(groupSchema.extend({ requestedOn: z.string() })),
  availableAsCapo: z.boolean(),
  capoOfReference: personRefSchema.nullable(),
  /** Set when this person is a Capo Admin, e.g. "Ingegneria Informatica". */
  capoScope: z.string().nullable(),
})

export const teamFieldsSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

export const teamMembershipSchema = z.object({
  team: teamIdSchema,
  role: z.enum(["member", "lead"]),
  since: z.string(),
  endedOn: z.string().nullable(),
  endReason: z.string().nullable(),
  fields: teamFieldsSchema,
})

export const censusEntrySchema = z.object({
  year: z.string(),
  /** `null`: expected, no answer yet. */
  answer: censusAnswerSchema.nullable(),
  answeredOn: z.string().nullable(),
  source: z.enum(["forms", "dashboard"]).nullable(),
  declaredMember: z.boolean().nullable(),
  reminders: z.number().int(),
})

export const accountSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("none") }),
  z.object({
    status: z.literal("invite"),
    email: z.string(),
    sentOn: z.string(),
    expiresOn: z.string(),
    sentBy: z.string(),
  }),
  z.object({ status: z.literal("linked"), email: z.string(), via: z.string(), linkedOn: z.string(), how: z.string() }),
  z.object({ status: z.literal("review"), reviewId: z.string(), issue: z.string() }),
])

export const consentsSchema = z.object({
  privacy: z.object({ version: z.string(), acceptedOn: z.string() }).nullable(),
  photo: z.object({ status: z.enum(["granted", "denied", "revoked"]), on: z.string() }).nullable(),
})

/** One row of the People lists: everything but notes, activity and discrepancies. */
export const personRowSchema = z.object({
  id: z.string(),
  profile: profileSchema,
  member: membershipSchema.nullable(),
  admin: adminRoleSchema.nullable(),
  teams: z.array(teamMembershipSchema),
  census: z.array(censusEntrySchema),
  consents: consentsSchema,
  account: accountSchema,
})

export const discrepancySchema = z.object({
  kind: z.enum(["declared-member", "telegram-mismatch", "needs-review"]),
  message: z.string(),
  suggestedTelegram: z.string().nullable(),
})

export const activitySchema = z.object({ actor: z.string(), text: z.string(), at: z.string() })

export const personRecordSchema = personRowSchema.extend({
  /** `null` without `people:read`. */
  notes: z.string().nullable(),
  discrepancies: z.array(discrepancySchema),
  activity: z.array(activitySchema),
})

export type Profile = z.infer<typeof profileSchema>
export type Membership = z.infer<typeof membershipSchema>
export type AdminRole = z.infer<typeof adminRoleSchema>
export type TeamFields = z.infer<typeof teamFieldsSchema>
export type TeamMembership = z.infer<typeof teamMembershipSchema>
export type CensusEntry = z.infer<typeof censusEntrySchema>
export type Account = z.infer<typeof accountSchema>
export type Consents = z.infer<typeof consentsSchema>
export type PersonRow = z.infer<typeof personRowSchema>
export type PersonRecord = z.infer<typeof personRecordSchema>
export type Discrepancy = z.infer<typeof discrepancySchema>

export const teamSummarySchema = z.object({
  id: teamIdSchema,
  name: z.string(),
  lead: personRefSchema.nullable(),
  members: z.array(personRowSchema),
})
export type TeamSummary = z.infer<typeof teamSummarySchema>

export const campaignSchema = z.object({
  id: z.string(),
  year: z.string(),
  status: z.enum(["open", "closed"]),
  openedOn: z.string(),
  closesOn: z.string(),
  source: z.string(),
  expected: z.number().int(),
  continuing: z.number().int(),
  leaving: z.number().int(),
  noAnswer: z.number().int(),
})
export type Campaign = z.infer<typeof campaignSchema>

export const campaignDetailSchema = z.object({ campaign: campaignSchema, people: z.array(personRowSchema) })
export type CampaignDetail = z.infer<typeof campaignDetailSchema>

export const censusAnswersSchema = z.array(z.object({ question: z.string(), answer: z.string() }))

export const reviewSchema = z.object({
  id: z.string(),
  kind: z.enum(REVIEW_KINDS),
  since: z.string(),
  account: z.object({ name: z.string(), email: z.string(), telegram: z.string().nullable(), via: z.string() }),
  record: personRefSchema.nullable(),
  other: personRefSchema.nullable(),
  message: z.string().nullable(),
})
export type Review = z.infer<typeof reviewSchema>

export const inviteSchema = z.object({
  personId: z.string(),
  name: z.string(),
  email: z.string(),
  sentOn: z.string(),
  expiresOn: z.string(),
  sentBy: z.string(),
})
export type Invite = z.infer<typeof inviteSchema>

export const accountMatchSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  telegram: z.string().nullable(),
  via: z.string(),
  linkedTo: personRefSchema.nullable(),
  reason: z.enum(["same-telegram", "same-email", "similar-name"]),
})
export type AccountMatch = z.infer<typeof accountMatchSchema>

const importRowSchema = z.object({
  row: z.number().int(),
  name: z.string(),
  detail: z.string(),
  answer: censusAnswerSchema.nullable(),
})
export const IMPORT_TABS = [
  "newPeople",
  "updates",
  "duplicates",
  "invalid",
  "discrepancies",
  "alreadyImported",
] as const
export type ImportTab = (typeof IMPORT_TABS)[number]

export const importPreviewSchema = z.object({
  importId: z.string(),
  fileName: z.string(),
  rows: z.number().int(),
  counts: z.object({
    newPeople: z.number().int(),
    updates: z.number().int(),
    duplicates: z.number().int(),
    invalid: z.number().int(),
    discrepancies: z.number().int(),
    alreadyImported: z.number().int(),
    leaving: z.number().int(),
  }),
  tabs: z.object({
    newPeople: z.array(importRowSchema),
    updates: z.array(importRowSchema),
    duplicates: z.array(importRowSchema),
    invalid: z.array(importRowSchema),
    discrepancies: z.array(importRowSchema),
    alreadyImported: z.array(importRowSchema),
  }),
  duplicates: z.array(
    z.object({
      pairId: z.string(),
      row: z.number().int(),
      recordId: z.string(),
      fields: z.array(z.object({ label: z.string(), file: z.string(), record: z.string(), mono: z.boolean() })),
    })
  ),
  telegram: z.array(
    z.object({
      rowId: z.string(),
      name: z.string(),
      username: z.string(),
      suggestion: z.object({ telegramId: z.string(), name: z.string(), info: z.string() }).nullable(),
    })
  ),
})
export type ImportPreview = z.infer<typeof importPreviewSchema>

export const capoAreaSchema = z.object({
  scope: z.string(),
  groups: z.array(groupSchema.extend({ admins: z.number().int() })),
  admins: z.array(personRowSchema),
  requests: z.array(z.object({ id: z.string(), person: personRefSchema, group: groupSchema, requestedOn: z.string() })),
})
export type CapoArea = z.infer<typeof capoAreaSchema>

export const myRolesSchema = z.object({
  /** The Capo Admin scope, when the signed-in person is one. */
  capoScope: z.string().nullable(),
  /** Teams the signed-in person leads. */
  leads: z.array(teamIdSchema),
})
export type MyRoles = z.infer<typeof myRolesSchema>

const contactSchema = z.object({
  role: z.enum(["capo", "lead", "hr"]),
  name: z.string(),
  telegram: z.string().nullable(),
  email: z.string().nullable(),
  team: teamIdSchema.nullable(),
})

export const myAreaSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("linked"),
    person: personRecordSchema,
    campaign: z.object({ id: z.string(), year: z.string(), closesOn: z.string() }).nullable(),
    contacts: z.array(contactSchema),
    roster: z
      .object({
        team: teamIdSchema,
        members: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.enum(["member", "lead"]),
            telegram: z.string().nullable(),
            email: z.string().nullable(),
          })
        ),
      })
      .nullable(),
  }),
  z.object({
    state: z.literal("match"),
    candidate: z.object({
      id: z.string(),
      name: z.string(),
      course: z.string(),
      year: z.string(),
      campus: campusSchema,
      roles: z.array(z.string()),
    }),
    reason: z.string(),
  }),
  z.object({ state: z.literal("none"), request: z.object({ sentOn: z.string() }).nullable() }),
])
export type MyArea = z.infer<typeof myAreaSchema>

/** The team-specific fields, in display order. */
export type TeamField = { key: string; label: string; kind: "text" | "multi"; mono?: boolean; options?: string[] }

export const TEAMS = {
  it: {
    name: "IT",
    fields: [
      { key: "github", label: "GitHub", kind: "text", mono: true },
      { key: "areas", label: "Areas", kind: "multi", options: ["Frontend", "Backend", "Bot", "Infrastructure"] },
    ],
  },
  hr: {
    name: "HR",
    fields: [
      { key: "focus", label: "Focus", kind: "multi", options: ["Recruiting", "Onboarding", "Census", "Wellbeing"] },
    ],
  },
  design: {
    name: "Design & Social",
    fields: [
      {
        key: "tools",
        label: "Tools",
        kind: "multi",
        options: ["Figma", "Illustrator", "Photoshop", "After Effects", "InDesign", "Premiere"],
      },
      { key: "portfolio", label: "Portfolio", kind: "text" },
    ],
  },
  intl: {
    name: "International",
    fields: [
      {
        key: "languages",
        label: "Languages",
        kind: "multi",
        options: ["English", "Spanish", "French", "German", "Chinese", "Portuguese"],
      },
    ],
  },
  events: {
    name: "Events & Partnerships",
    fields: [
      {
        key: "focus",
        label: "Focus",
        kind: "multi",
        options: ["Partnerships", "Logistics", "Sponsorships", "Communication"],
      },
    ],
  },
} satisfies Record<TeamId, { name: string; fields: TeamField[] }>

// Inputs. The server functions validate with these, and the fake and real APIs take the parsed values.

const personIdSchema = z.string().regex(/^P-\d{4}$/)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const reasonSchema = z.string().trim().min(1).max(500)

export const personInputSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  personalEmail: z.email(),
  phone: z.string().trim().max(40),
  telegramUsername: z
    .string()
    .trim()
    .max(40)
    .transform((value) => value.replace(/^@/, "")),
  course: z.string().trim().min(1).max(120),
  year: z.enum(YEARS),
  campus: campusSchema,
})
export const createPersonInputSchema = personInputSchema.extend({ admin: z.boolean() })
export const updatePersonInputSchema = personInputSchema.extend({ id: personIdSchema })
export const setNoteInputSchema = z.object({ id: personIdSchema, note: z.string().trim().max(2000) })

export const createMemberInputSchema = z.object({
  personId: personIdSchema,
  number: z.string().regex(/^\d{4}$/),
  admittedOn: dateSchema,
  fee: z.enum(["due", "receipt", "paid"]),
})
export const memberStatusInputSchema = z.object({
  personId: personIdSchema,
  status: memberStatusSchema,
  reason: z.string().trim().max(500),
})
export const memberNumberInputSchema = z.object({ personId: personIdSchema, number: z.string().regex(/^\d{4}$/) })

export const endAdminInputSchema = z.object({ personId: personIdSchema, reason: reasonSchema })
export const capoScopeInputSchema = z.object({ personId: personIdSchema, scope: z.string().trim().max(120).nullable() })

export const addTeamMemberInputSchema = z.object({
  teamId: teamIdSchema,
  personId: personIdSchema,
  role: z.enum(["member", "lead"]),
  since: dateSchema,
  fields: teamFieldsSchema,
})
export const teamFieldsInputSchema = z.object({
  teamId: teamIdSchema,
  personId: personIdSchema,
  fields: teamFieldsSchema,
})
export const endTeamInputSchema = z.object({
  teamId: teamIdSchema,
  personId: personIdSchema,
  lastDay: dateSchema,
  reason: reasonSchema,
  note: z.string().trim().max(500),
})

export const campaignInputSchema = z.object({ campaignId: z.string().min(1) })
export const remindInputSchema = z.object({ campaignId: z.string().min(1), personId: personIdSchema.nullable() })
export const answersInputSchema = z.object({ personId: personIdSchema, year: z.string().min(1) })
export const importCommitInputSchema = z.object({
  importId: z.string().min(1),
  duplicates: z.record(z.string(), z.enum(["same", "different"])),
  telegram: z.record(z.string(), z.string().nullable()),
})

export const resolveReviewInputSchema = z.object({
  reviewId: z.string().min(1),
  resolution: z.string().min(1),
  reason: reasonSchema,
})
export const reviewInputSchema = z.object({ reviewId: z.string().min(1) })
export const personRefInputSchema = z.object({ personId: personIdSchema })
export const searchAccountsInputSchema = z.object({ personId: personIdSchema, query: z.string().trim().max(120) })
export const linkAccountInputSchema = z.object({
  personId: personIdSchema,
  accountId: z.string().min(1),
  reason: reasonSchema,
})

export const joinRequestInputSchema = z.object({ requestId: z.string().min(1) })

export const askToBeAddedInputSchema = z.object({
  roles: z.array(z.enum(["admin", "team", "member"])).min(1),
  groupsOrTeam: z.string().trim().max(200),
  telegramUsername: z.string().trim().max(40),
})
export const answerCensusInputSchema = z.object({
  answer: censusAnswerSchema,
  course: z.string().trim().min(1).max(120),
  year: z.enum(YEARS),
  campus: campusSchema,
  keepGroups: z.array(z.string()),
  keepTeams: z.array(teamIdSchema),
  reason: z.string().trim().max(200),
  note: z.string().trim().max(500),
})
export const correctionInputSchema = z.object({
  field: z.string().min(1),
  value: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500),
})

export type CreatePersonInput = z.infer<typeof createPersonInputSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonInputSchema>
export type SetNoteInput = z.infer<typeof setNoteInputSchema>
export type CreateMemberInput = z.infer<typeof createMemberInputSchema>
export type MemberStatusInput = z.infer<typeof memberStatusInputSchema>
export type MemberNumberInput = z.infer<typeof memberNumberInputSchema>
export type EndAdminInput = z.infer<typeof endAdminInputSchema>
export type CapoScopeInput = z.infer<typeof capoScopeInputSchema>
export type AddTeamMemberInput = z.infer<typeof addTeamMemberInputSchema>
export type TeamFieldsInput = z.infer<typeof teamFieldsInputSchema>
export type EndTeamInput = z.infer<typeof endTeamInputSchema>
export type RemindInput = z.infer<typeof remindInputSchema>
export type AnswersInput = z.infer<typeof answersInputSchema>
export type ImportCommitInput = z.infer<typeof importCommitInputSchema>
export type ResolveReviewInput = z.infer<typeof resolveReviewInputSchema>
export type SearchAccountsInput = z.infer<typeof searchAccountsInputSchema>
export type LinkAccountInput = z.infer<typeof linkAccountInputSchema>
export type AskToBeAddedInput = z.infer<typeof askToBeAddedInputSchema>
export type AnswerCensusInput = z.infer<typeof answerCensusInputSchema>
export type CorrectionInput = z.infer<typeof correctionInputSchema>

export const remindResultSchema = z.object({ sent: z.number().int(), skipped: z.number().int() })
export const exportResultSchema = z.object({ filename: z.string(), csv: z.string() })
export const createdSchema = z.object({ id: z.string() })
export const importedSchema = z.object({ imported: z.number().int() })

/** A team's fields in display order, typed for rendering and forms. */
export function teamFields(team: TeamId): TeamField[] {
  return TEAMS[team].fields
}
