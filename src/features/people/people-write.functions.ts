import { createServerFn } from "@tanstack/react-start"

import { peopleWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import {
  capoRefInputSchema,
  createPersonInputSchema,
  endAdminInputSchema,
  linkAccountInputSchema,
  personRefInputSchema,
  resolveReviewInputSchema,
  reviewInputSchema,
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

/** The bot removes their admin rights in every group; the record keeps the history. */
export const endAdminRole = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(endAdminInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).endAdmin(data))

export const setCapoOfReference = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(capoRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setCapoOfReference(data))

/** Settles a Needs review item with one of its kind's resolutions; the reason is saved in the record's activity. */
export const resolveLinkingReview = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(resolveReviewInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).resolveReview(data))

/** Drops a Needs review item without linking anything. */
export const dismissLinkingReview = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(reviewInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).dismissReview(data))
