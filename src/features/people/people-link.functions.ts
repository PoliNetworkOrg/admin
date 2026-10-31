import { createServerFn } from "@tanstack/react-start"

import { peopleLinkMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { linkAccountInputSchema, searchAccountsInputSchema, unlinkAccountInputSchema } from "./people.contract"

/** Sign-in accounts in the IdP directory, with the record each is linked to. */
export const searchPeopleAccounts = createServerFn({ method: "GET" })
  .middleware([peopleLinkMiddleware])
  .validator(searchAccountsInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).searchAccounts(data))

/** Links by hand: the record's pending assignments go to Auth, acting as whoever links. */
export const linkPersonAccount = createServerFn({ method: "POST" })
  .middleware([peopleLinkMiddleware])
  .validator(linkAccountInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).linkAccount(data))

/** Auth takes the record's roles back, then the account is detached; the assignments wait as pending. */
export const unlinkPersonAccount = createServerFn({ method: "POST" })
  .middleware([peopleLinkMiddleware])
  .validator(unlinkAccountInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).unlinkAccount(data))
