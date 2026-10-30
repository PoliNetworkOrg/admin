import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { peopleReadMiddleware, peopleSelfMiddleware, peopleWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { personIdSchema, searchAccountsInputSchema } from "./people.contract"

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

export const getPendingInvites = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listInvites())

/** Sign-in accounts that could be this person's, with why they match. Needed only to link, hence the write scope. */
export const searchPeopleAccounts = createServerFn({ method: "GET" })
  .middleware([peopleWriteMiddleware])
  .validator(searchAccountsInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).searchAccounts(data))
