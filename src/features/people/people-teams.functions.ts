import { createServerFn } from "@tanstack/react-start"

import { peopleTeamReadMiddleware, peopleTeamWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  addTeamMemberInputSchema,
  endTeamInputSchema,
  teamCandidatesInputSchema,
  teamFieldsInputSchema,
} from "./people.contract"

/** Every team with `people:read`; a Team Lead gets only the teams they lead. */
export const getTeams = createServerFn({ method: "GET" })
  .middleware([peopleTeamReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listTeams())

/** Names and courses of the people who could join a team; Team Leads see no more than that. */
export const getTeamCandidates = createServerFn({ method: "GET" })
  .middleware([peopleTeamReadMiddleware])
  .validator(teamCandidatesInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).listTeamCandidates(data))

/** `people:write` or the team's Lead; the backend also requires `people:appoint` for role `lead`. */
export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([peopleTeamWriteMiddleware])
  .validator(addTeamMemberInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).addTeamMember(data))

export const updateTeamFields = createServerFn({ method: "POST" })
  .middleware([peopleTeamWriteMiddleware])
  .validator(teamFieldsInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).updateTeamFields(data))

/**
 * Ends a membership with its last day and reason; the history stays on the record. The backend requires
 * `people:appoint` to end a `lead` membership.
 */
export const endTeamMembership = createServerFn({ method: "POST" })
  .middleware([peopleTeamWriteMiddleware])
  .validator(endTeamInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).endTeamMembership(data))
