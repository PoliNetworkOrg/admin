import { appointCapo, endCapo, setCapoScope } from "@/features/people/people-appoint.functions"
import { getCapoArea } from "@/features/people/people-capo.functions"
import {
  acceptPeopleInvite,
  checkPeopleInvite,
  getPeopleInviteOutcome,
} from "@/features/people/people-invite-landing.functions"
import { revokePersonInvite, sendPersonInvite } from "@/features/people/people-invites.functions"
import { linkPersonAccount, searchPeopleAccounts, unlinkPersonAccount } from "@/features/people/people-link.functions"
import { getMyArea } from "@/features/people/people-self.functions"
import {
  addTeamMember,
  endTeamMembership,
  getTeamCandidates,
  getTeams,
  updateTeamFields,
} from "@/features/people/people-teams.functions"
import {
  assignAdmin,
  createPerson,
  endAdminRole,
  setCapoOfReference,
  setPersonNote,
  updatePerson,
} from "@/features/people/people-write.functions"
import {
  addTeamMemberInputSchema,
  appointCapoInputSchema,
  assignAdminInputSchema,
  capoRefInputSchema,
  capoScopeInputSchema,
  endAssignmentInputSchema,
  endTeamInputSchema,
  inviteTokenInputSchema,
  linkAccountInputSchema,
  newPersonInputSchema,
  personRefInputSchema,
  searchAccountsInputSchema,
  setNoteInputSchema,
  TEAM_IDS,
  TEAMS,
  teamCandidatesInputSchema,
  teamFieldsInputSchema,
  unlinkAccountInputSchema,
  updatePersonInputSchema,
} from "@/features/people/people.contract"
import {
  getAdminsAndCapos,
  getAssociationSuggestions,
  getCourses,
  getMyPeopleRoles,
  getPendingInvites,
  getPeople,
  getPerson,
  getPersonInput,
  getRecentLinks,
} from "@/features/people/people.functions"

import { destructive, read, write } from "../operation"

/** Each team's field keys, `[]` for a list of strings, as `fields` takes them. */
const TEAM_FIELD_KEYS = TEAM_IDS.map(
  (team) =>
    `${team}: ${TEAMS[team].fields.map((field) => (field.kind === "multi" ? `${field.key}[]` : field.key)).join(", ")}`
).join("; ")

const ROLES_NOTE = "Pending until the record is linked to an account; then PoliNetwork Auth applies it, or refuses."

const PROFILE_NOTE =
  "Profile: courseCode (an active course from people.courses.list), campus, otherAssociations (names, spelled as in people.associations.suggest), representativeRoles (ccs and school need a course; other needs representativeOther, the seat's name)."

export const peopleOperations = [
  // Records.
  read("people.persons.list", getPeople, {
    guard: "peopleReadMiddleware",
    description:
      "List every People record (IDs like P-0001) with its account status, role assignments, course and campus.",
  }),
  read("people.persons.get", getPerson, {
    guard: "peopleReadMiddleware",
    input: getPersonInput,
    description:
      "One People record by ID (from people.persons.list): contacts, profile (course, campus, other associations, representative seats), note, account, assignments, activity.",
  }),
  write("people.persons.create", createPerson, {
    guard: "peopleWriteMiddleware",
    input: newPersonInputSchema,
    description: `Add a People record, starting from today the roles given (Admin, Capo Admin with its scope, teams). The result lists roles refused, in the backend's words. ${ROLES_NOTE} ${PROFILE_NOTE} Omitted profile fields are empty.`,
  }),
  write("people.persons.update", updatePerson, {
    guard: "peopleWriteMiddleware",
    input: updatePersonInputSchema,
    description: `Edit a People record's name, contacts (empty string when unknown) and profile. ${PROFILE_NOTE} An omitted profile field stays unchanged: send only what changes, after reading the record.`,
  }),
  read("people.courses.list", getCourses, {
    guard: "peopleReadMiddleware",
    description:
      "Every Politecnico degree course (code, name, level, school, regulation, campuses, languages), active or no longer offered, sorted by school, level and name. A degree can appear twice, under the current regulation (96/23) and the older one (270), with different codes. A record's courseCode must be an active one's code.",
  }),
  read("people.associations.suggest", getAssociationSuggestions, {
    guard: "peopleReadMiddleware",
    description:
      "The association names already on records, most used first: reuse their spelling in otherAssociations.",
  }),
  write("people.persons.setNote", setPersonNote, {
    guard: "peopleWriteMiddleware",
    input: setNoteInputSchema,
    description: "Replace a People record's internal note (empty clears it).",
  }),

  // Admins and Capo Admins.
  read("people.admins.list", getAdminsAndCapos, {
    guard: "peopleReadMiddleware",
    description: "Current admins with their Capo Admin of reference, and the Capo Admins with their scope and admins.",
  }),
  write("people.admins.assign", assignAdmin, {
    guard: "peopleWriteMiddleware",
    input: assignAdminInputSchema,
    description: `Make a person an admin from a date, optionally with a Capo Admin of reference (person ID). ${ROLES_NOTE}`,
  }),
  destructive("people.admins.end", endAdminRole, {
    guard: "peopleWriteMiddleware",
    input: endAssignmentInputSchema,
    description:
      "End a person's Admin role with a reason; PoliNetwork Auth revokes it. The history stays on the record.",
  }),
  write("people.admins.setCapoOfReference", setCapoOfReference, {
    guard: "peopleWriteMiddleware",
    input: capoRefInputSchema,
    description: "Set or clear (null) an admin's Capo Admin of reference, by person ID from people.admins.list.",
  }),
  write("people.capos.appoint", appointCapo, {
    guard: "peopleAppointMiddleware",
    input: appointCapoInputSchema,
    description: `Appoint a current admin Capo Admin of a scope (e.g. a school) from a date. ${ROLES_NOTE}`,
  }),
  write("people.capos.setScope", setCapoScope, {
    guard: "peopleAppointMiddleware",
    input: capoScopeInputSchema,
    description: "Change a Capo Admin's scope. People's own data: nothing changes in PoliNetwork Auth.",
  }),
  destructive("people.capos.end", endCapo, {
    guard: "peopleAppointMiddleware",
    input: endAssignmentInputSchema,
    description:
      "End a Capo Admin role with a reason; Auth revokes it. They stay an admin; their admins are left without a Capo Admin of reference.",
  }),

  // Teams.
  read("people.teams.list", getTeams, {
    guard: "peopleTeamReadMiddleware",
    description:
      "Teams with their Lead, members and which roles can be assigned. With people:read every team; a Team Lead gets only the teams they lead.",
  }),
  read("people.teams.candidates", getTeamCandidates, {
    guard: "peopleTeamReadMiddleware",
    input: teamCandidatesInputSchema,
    description: "Names and person IDs of the people who could join a team.",
  }),
  write("people.teams.addMember", addTeamMember, {
    guard: "peopleTeamWriteMiddleware",
    input: addTeamMemberInputSchema,
    description: `Add a person to a team as member or lead (lead needs people:appoint) from a date. ${ROLES_NOTE} Field keys: ${TEAM_FIELD_KEYS}.`,
  }),
  write("people.teams.updateFields", updateTeamFields, {
    guard: "peopleTeamWriteMiddleware",
    input: teamFieldsInputSchema,
    description: `Replace a team member's team-specific fields. Field keys: ${TEAM_FIELD_KEYS}.`,
  }),
  destructive("people.teams.endMembership", endTeamMembership, {
    guard: "peopleTeamWriteMiddleware",
    input: endTeamInputSchema,
    description:
      "End a person's team membership with a reason (ending a lead needs people:appoint); Auth revokes the role. The history stays.",
  }),

  // Accounts and invites.
  read("people.invites.listPending", getPendingInvites, {
    guard: "peopleReadMiddleware",
    description: "Open invites: who, to which email, sent and expiry dates, sent by whom.",
  }),
  destructive("people.invites.send", sendPersonInvite, {
    guard: "peopleTeamWriteMiddleware",
    input: personRefInputSchema,
    description:
      "Email an invite to link an account to the record's contact email; an open invite's link stops working. people:write, or a Lead of one of the person's teams.",
  }),
  destructive("people.invites.revoke", revokePersonInvite, {
    guard: "peopleTeamWriteMiddleware",
    input: personRefInputSchema,
    description: "Revoke the record's open invite: its link stops working.",
  }),
  read("people.links.recent", getRecentLinks, {
    guard: "peopleReadMiddleware",
    description: "Accounts linked to records in the last 30 days, how (invite, by hand, Auth) and by whom.",
  }),
  read("people.accounts.search", searchPeopleAccounts, {
    guard: "peopleLinkMiddleware",
    input: searchAccountsInputSchema,
    description: "Search sign-in accounts in the IdP directory by name or email, with the record each is linked to.",
  }),
  write("people.accounts.link", linkPersonAccount, {
    guard: "peopleLinkMiddleware",
    input: linkAccountInputSchema,
    description:
      "Link a record to a sign-in account (ID from people.accounts.search) with a reason; its pending roles go to PoliNetwork Auth.",
  }),
  destructive("people.accounts.unlink", unlinkPersonAccount, {
    guard: "peopleLinkMiddleware",
    input: unlinkAccountInputSchema,
    description: "Unlink a record's account with a reason: Auth takes its roles back, which then wait as pending.",
  }),

  // The caller's own record, Capo Admin area and invite.
  read("people.me.area", getMyArea, {
    guard: "peopleSelfMiddleware",
    description:
      "The caller's own People record, contacts (Capo Admin, Leads, HR) and team roster, or state none if no record is linked.",
  }),
  read("people.me.roles", getMyPeopleRoles, {
    guard: "peopleSelfMiddleware",
    description: "The caller's Capo Admin scope and the teams they lead, from their own record.",
  }),
  read("people.capoArea.get", getCapoArea, {
    guard: "peopleSelfMiddleware",
    description: "For a Capo Admin: their scope and the admins who have them as Capo Admin of reference.",
  }),
  read("people.myInvite.check", checkPeopleInvite, {
    guard: "peopleInviteMiddleware",
    input: inviteTokenInputSchema,
    description:
      "Check an invite token (from the /people/invite?token= link the person received): whose record it is for, or why it no longer works.",
  }),
  destructive("people.myInvite.accept", acceptPeopleInvite, {
    guard: "peopleInviteMiddleware",
    input: inviteTokenInputSchema,
    description:
      "Accept an invite as the caller: links the caller's account to the invited record and spends the token. Its roles then go to PoliNetwork Auth.",
  }),
  read("people.myInvite.outcome", getPeopleInviteOutcome, {
    guard: "peopleInviteMiddleware",
    description:
      "After accepting an invite: the record's roles and their status with Auth, or waiting until Auth applies them. Call refresh_permissions first.",
  }),
]
