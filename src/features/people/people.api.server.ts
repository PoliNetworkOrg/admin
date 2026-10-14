import type { z } from "zod"

import { createUntypedBackendClient } from "@/server/backend.server"

import {
  type AddTeamMemberInput,
  type AnswerCensusInput,
  type AnswersInput,
  type AskToBeAddedInput,
  accountMatchSchema,
  type AccountMatch,
  type Campaign,
  campaignDetailSchema,
  type CampaignDetail,
  campaignSchema,
  type CapoArea,
  capoAreaSchema,
  type CapoRefInput,
  type CapoScopeInput,
  censusAnswersSchema,
  type CorrectionInput,
  type CreateMemberInput,
  type CreatePersonInput,
  createdSchema,
  type EndAdminInput,
  type EndTeamInput,
  exportResultSchema,
  type ImportCommitInput,
  importedSchema,
  type ImportPreview,
  importPreviewSchema,
  type Invite,
  inviteSchema,
  type LinkAccountInput,
  type MemberNumberInput,
  type MemberStatusInput,
  type MyArea,
  myAreaSchema,
  type MyRoles,
  myRolesSchema,
  type PersonRecord,
  personRecordSchema,
  type PersonRow,
  personRowSchema,
  type RemindInput,
  remindResultSchema,
  type ResolveReviewInput,
  type Review,
  reviewSchema,
  type SearchAccountsInput,
  type SetNoteInput,
  type TeamFieldsInput,
  type TeamSummary,
  teamSummarySchema,
  type UpdatePersonInput,
} from "./people.contract"

/** Who is asking: their permissions, and their own record in agent mode (`AGENT_PERSON`). */
export type PeopleViewer = { permissions: readonly string[]; personId: string | null }

/** The `people.*` procedures (docs/people/contract.md), one method each. */
export type PeopleApi = {
  listPeople: () => Promise<PersonRow[]>
  getPerson: (id: string) => Promise<PersonRecord>
  createPerson: (input: CreatePersonInput) => Promise<{ id: string }>
  updatePerson: (input: UpdatePersonInput) => Promise<void>
  setNote: (input: SetNoteInput) => Promise<void>
  createMember: (input: CreateMemberInput) => Promise<void>
  setMemberStatus: (input: MemberStatusInput) => Promise<void>
  setMemberNumber: (input: MemberNumberInput) => Promise<void>
  exportMembers: () => Promise<{ filename: string; csv: string }>
  endAdmin: (input: EndAdminInput) => Promise<void>
  setCapoScope: (input: CapoScopeInput) => Promise<void>
  setCapoOfReference: (input: CapoRefInput) => Promise<void>
  listTeams: () => Promise<TeamSummary[]>
  addTeamMember: (input: AddTeamMemberInput) => Promise<void>
  updateTeamFields: (input: TeamFieldsInput) => Promise<void>
  endTeamMembership: (input: EndTeamInput) => Promise<void>
  listCampaigns: () => Promise<Campaign[]>
  getCampaign: (id: string) => Promise<CampaignDetail>
  getAnswers: (input: AnswersInput) => Promise<{ question: string; answer: string }[]>
  remind: (input: RemindInput) => Promise<{ sent: number; skipped: number }>
  closeCampaign: (id: string) => Promise<void>
  importPreview: (campaignId: string, file: File) => Promise<ImportPreview>
  importCommit: (input: ImportCommitInput) => Promise<{ imported: number }>
  listReviews: () => Promise<Review[]>
  resolveReview: (input: ResolveReviewInput) => Promise<void>
  dismissReview: (input: { reviewId: string }) => Promise<void>
  listInvites: () => Promise<Invite[]>
  sendInvite: (input: { personId: string }) => Promise<void>
  revokeInvite: (input: { personId: string }) => Promise<void>
  searchAccounts: (input: SearchAccountsInput) => Promise<AccountMatch[]>
  linkAccount: (input: LinkAccountInput) => Promise<void>
  unlinkAccount: (input: { personId: string }) => Promise<void>
  getCapoArea: () => Promise<CapoArea>
  approveJoinRequest: (input: { requestId: string }) => Promise<void>
  declineJoinRequest: (input: { requestId: string }) => Promise<void>
  getMyRoles: () => Promise<MyRoles>
  getMyArea: () => Promise<MyArea>
  confirmMatch: () => Promise<void>
  rejectMatch: () => Promise<void>
  askToBeAdded: (input: AskToBeAddedInput) => Promise<void>
  answerCensus: (input: AnswerCensusInput) => Promise<void>
  requestCorrection: (input: CorrectionInput) => Promise<void>
  revokePhotoConsent: () => Promise<void>
}

/**
 * The backend's `people.*` procedures. The published router type doesn't declare them yet, so every response is
 * parsed with the contract's schema: a backend that drifts from the contract fails loudly here, not in a page.
 */
function backendPeopleApi(accessToken: string | null): PeopleApi {
  const client = createUntypedBackendClient(accessToken)
  const query = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.query(`people.${path}`, input))
  const mutate = async <I>(path: string, input?: I) => {
    await client.mutation(`people.${path}`, input)
  }
  const mutateParsed = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.mutation(`people.${path}`, input))

  return {
    listPeople: () => query("persons.list", undefined, personRowSchema.array()),
    getPerson: (id) => query("persons.get", { id }, personRecordSchema),
    createPerson: (input) => mutateParsed("persons.create", input, createdSchema),
    updatePerson: (input) => mutate("persons.update", input),
    setNote: (input) => mutate("persons.setNote", input),
    createMember: (input) => mutate("members.create", input),
    setMemberStatus: (input) => mutate("members.setStatus", input),
    setMemberNumber: (input) => mutate("members.setNumber", input),
    exportMembers: () => mutateParsed("members.export", undefined, exportResultSchema),
    endAdmin: (input) => mutate("admins.end", input),
    setCapoScope: (input) => mutate("admins.setCapoScope", input),
    setCapoOfReference: (input) => mutate("admins.setCapoOfReference", input),
    listTeams: () => query("teams.list", undefined, teamSummarySchema.array()),
    addTeamMember: (input) => mutate("teams.addMember", input),
    updateTeamFields: (input) => mutate("teams.updateFields", input),
    endTeamMembership: (input) => mutate("teams.endMembership", input),
    listCampaigns: () => query("census.campaigns", undefined, campaignSchema.array()),
    getCampaign: (id) => query("census.campaign", { id }, campaignDetailSchema),
    getAnswers: (input) => query("census.answers", input, censusAnswersSchema),
    remind: (input) => mutateParsed("census.remind", input, remindResultSchema),
    closeCampaign: (id) => mutate("census.close", { campaignId: id }),
    importPreview: (campaignId, file) => {
      const form = new FormData()
      form.set("campaignId", campaignId)
      form.set("file", file)
      return mutateParsed("census.importPreview", form, importPreviewSchema)
    },
    importCommit: (input) => mutateParsed("census.importCommit", input, importedSchema),
    listReviews: () => query("linking.reviews", undefined, reviewSchema.array()),
    resolveReview: (input) => mutate("linking.resolve", input),
    dismissReview: (input) => mutate("linking.dismiss", input),
    listInvites: () => query("linking.invites", undefined, inviteSchema.array()),
    sendInvite: (input) => mutate("linking.sendInvite", input),
    revokeInvite: (input) => mutate("linking.revokeInvite", input),
    searchAccounts: (input) => query("linking.searchAccounts", input, accountMatchSchema.array()),
    linkAccount: (input) => mutate("linking.link", input),
    unlinkAccount: (input) => mutate("linking.unlink", input),
    getCapoArea: () => query("capo.get", undefined, capoAreaSchema),
    approveJoinRequest: (input) => mutate("capo.approve", input),
    declineJoinRequest: (input) => mutate("capo.decline", input),
    getMyRoles: () => query("me.roles", undefined, myRolesSchema),
    getMyArea: () => query("me.get", undefined, myAreaSchema),
    confirmMatch: () => mutate("me.confirmMatch"),
    rejectMatch: () => mutate("me.rejectMatch"),
    askToBeAdded: (input) => mutate("me.askToBeAdded", input),
    answerCensus: (input) => mutate("me.answerCensus", input),
    requestCorrection: (input) => mutate("me.requestCorrection", input),
    revokePhotoConsent: () => mutate("me.revokePhotoConsent"),
  }
}

type PeopleContext = {
  agentMode: boolean
  session: { accessToken: string | null }
  permissions: readonly string[]
}

/** The People API for this request: the sample data in agent mode, the backend otherwise. */
export async function peopleApi(context: PeopleContext): Promise<PeopleApi> {
  if (context.agentMode) {
    const [{ fakePeopleApi }, { env }] = await Promise.all([import("./people.fake.server"), import("@/env")])
    return fakePeopleApi({ permissions: context.permissions, personId: env.AGENT_PERSON })
  }
  return backendPeopleApi(context.session.accessToken)
}
