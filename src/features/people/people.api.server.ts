import type { z } from "zod"

import { createUntypedBackendClient } from "@/server/backend.server"

import {
  type AcceptInviteInput,
  type AddTeamMemberInput,
  accountMatchSchema,
  type AccountMatch,
  type CapoArea,
  capoAreaSchema,
  type CapoRefInput,
  type CapoScopeInput,
  type CreatePersonInput,
  createdSchema,
  type EndAdminInput,
  type EndTeamInput,
  type Invite,
  inviteSchema,
  type LinkAccountInput,
  type MyArea,
  myAreaSchema,
  type MyRoles,
  myRolesSchema,
  type PersonRecord,
  personRecordSchema,
  type PersonRow,
  personRowSchema,
  type SearchAccountsInput,
  type SetNoteInput,
  type TeamCandidate,
  teamCandidateSchema,
  type TeamCandidatesInput,
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
  endAdmin: (input: EndAdminInput) => Promise<void>
  setCapoScope: (input: CapoScopeInput) => Promise<void>
  setCapoOfReference: (input: CapoRefInput) => Promise<void>
  listTeams: () => Promise<TeamSummary[]>
  listTeamCandidates: (input: TeamCandidatesInput) => Promise<TeamCandidate[]>
  addTeamMember: (input: AddTeamMemberInput) => Promise<void>
  updateTeamFields: (input: TeamFieldsInput) => Promise<void>
  endTeamMembership: (input: EndTeamInput) => Promise<void>
  listInvites: () => Promise<Invite[]>
  sendInvite: (input: { personId: string }) => Promise<void>
  revokeInvite: (input: { personId: string }) => Promise<void>
  searchAccounts: (input: SearchAccountsInput) => Promise<AccountMatch[]>
  linkAccount: (input: LinkAccountInput) => Promise<void>
  unlinkAccount: (input: { personId: string }) => Promise<void>
  getCapoArea: () => Promise<CapoArea>
  getMyRoles: () => Promise<MyRoles>
  getMyArea: () => Promise<MyArea>
  acceptInvite: (input: AcceptInviteInput) => Promise<void>
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
    endAdmin: (input) => mutate("admins.end", input),
    setCapoScope: (input) => mutate("admins.setCapoScope", input),
    setCapoOfReference: (input) => mutate("admins.setCapoOfReference", input),
    listTeams: () => query("teams.list", undefined, teamSummarySchema.array()),
    listTeamCandidates: (input) => query("teams.candidates", input, teamCandidateSchema.array()),
    addTeamMember: (input) => mutate("teams.addMember", input),
    updateTeamFields: (input) => mutate("teams.updateFields", input),
    endTeamMembership: (input) => mutate("teams.endMembership", input),
    listInvites: () => query("linking.invites", undefined, inviteSchema.array()),
    sendInvite: (input) => mutate("linking.sendInvite", input),
    revokeInvite: (input) => mutate("linking.revokeInvite", input),
    searchAccounts: (input) => query("linking.searchAccounts", input, accountMatchSchema.array()),
    linkAccount: (input) => mutate("linking.link", input),
    unlinkAccount: (input) => mutate("linking.unlink", input),
    getCapoArea: () => query("capo.get", undefined, capoAreaSchema),
    getMyRoles: () => query("me.roles", undefined, myRolesSchema),
    getMyArea: () => query("me.get", undefined, myAreaSchema),
    acceptInvite: (input) => mutate("me.acceptInvite", input),
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
