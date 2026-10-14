import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"

/** The Capo Admin scope and led teams on the signed-in person's record; they open Capo Admin and their team page. */
export const getMyPeopleRoles = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getMyRoles())
