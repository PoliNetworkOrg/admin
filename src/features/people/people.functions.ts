import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { peopleReadMiddleware, peopleSelfMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { personIdSchema } from "./people.contract"

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

/** People › Admins: current admins with their Capo Admin of reference, and the Capo Admins with their admins. */
export const getAdminsAndCapos = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => {
    const api = await peopleApi(context)
    const [admins, capos] = await Promise.all([api.listAdmins(), api.listCapos()])
    return { admins, capos }
  })

export const getPendingInvites = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listInvites())

/** Links made in the last 30 days, so a mistake or a forwarded invite is easy to spot and undo. */
export const getRecentLinks = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listRecentLinks())
