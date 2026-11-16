import { createServerFn } from "@tanstack/react-start"

import { peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"

/**
 * Telegram › Capo Admin: the signed-in person's scope and the admins who have them as Capo Admin of reference. The
 * backend scopes it to the Capo Admin role on their own record; `people:self` only lets them ask.
 */
export const getCapoArea = createServerFn({ method: "GET" })
  .middleware([peopleSelfMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).getCapoArea())
