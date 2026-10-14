import { createServerFn } from "@tanstack/react-start"

import { peopleWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  createPersonInputSchema,
  linkAccountInputSchema,
  personRefInputSchema,
  setNoteInputSchema,
  updatePersonInputSchema,
} from "./people.contract"

export const createPerson = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(createPersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).createPerson(data))

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(updatePersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).updatePerson(data))

export const setPersonNote = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(setNoteInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setNote(data))

/** Sends an invite, or a new one replacing the pending invite (its link stops working). */
export const sendPersonInvite = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(personRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).sendInvite(data))

export const revokePersonInvite = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(personRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).revokeInvite(data))

export const linkPersonAccount = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(linkAccountInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).linkAccount(data))

export const unlinkPersonAccount = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(personRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).unlinkAccount(data))
