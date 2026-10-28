import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { peopleReadMiddleware, peopleSelfMiddleware, peopleWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { answersInputSchema, personIdSchema, searchAccountsInputSchema } from "./people.contract"

/** The Capo Admin scope and led teams on the signed-in person's record; they open Capo Admin and their team page. */
export const getMyPeopleRoles = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getMyRoles())

export const getPeople = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listPeople())

export const getPerson = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .validator(z.object({ id: personIdSchema }))
  .handler(async ({ data, context }) => (await peopleApi(context)).getPerson(data.id))

/** People › Linking's Needs review queue: sign-ins the backend couldn't link on its own. */
export const getLinkingReviews = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listReviews())

export const getPendingInvites = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listInvites())

/** Links of the last 30 days, so HR can spot and undo a mistaken one. */
export const getRecentLinks = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listRecentLinks())

/** A census year's full answers: HR and the Direttivo only (`people:read`). */
export const getCensusAnswers = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .validator(answersInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).getAnswers(data))

/** Sign-in accounts that could be this person's, with why they match. Needed only to link, hence the write scope. */
export const searchPeopleAccounts = createServerFn({ method: "GET" })
  .middleware([peopleWriteMiddleware])
  .validator(searchAccountsInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).searchAccounts(data))
