import { createServerFn } from "@tanstack/react-start"

import { peopleMembersReadMiddleware, peopleMembersWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { createMemberInputSchema, memberNumberInputSchema, memberStatusInputSchema } from "./people.contract"

/** The register and names of admission candidates; no general People read permission needed. */
export const getMemberRegister = createServerFn({ method: "GET" })
  .middleware([peopleMembersReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listMembers())

/** Registers a member; the backend starts the new-member workflow, which creates their Microsoft 365 account. */
export const createMember = createServerFn({ method: "POST" })
  .middleware([peopleMembersWriteMiddleware])
  .validator(createMemberInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).createMember(data))

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([peopleMembersWriteMiddleware])
  .validator(memberStatusInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setMemberStatus(data))

/** Also changes the member ID on the person's Microsoft 365 account. */
export const setMemberNumber = createServerFn({ method: "POST" })
  .middleware([peopleMembersWriteMiddleware])
  .validator(memberNumberInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setMemberNumber(data))

/** A POST so the export, which holds personal data, is never cached or prefetched. */
export const exportMembers = createServerFn({ method: "POST" })
  .middleware([peopleMembersWriteMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).exportMembers())
