import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  azureMembersCreateMiddleware,
  azureMembersReadMiddleware,
  azureMembersWriteMiddleware,
} from "@/server/auth.middleware"

export const getAzureMembers = createServerFn({ method: "GET" })
  .middleware([azureMembersReadMiddleware])
  .handler(({ context }) => context.backend.azure.members.getAll.query())

const setMemberNumberResultSchema = z.object({
  error: z.string().nullable(),
  notificationSent: z.boolean().nullable().optional(),
})

export const createAzureMember = createServerFn({ method: "POST" })
  .middleware([azureMembersCreateMiddleware])
  .validator(
    z.object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      assocNumber: z.number().int().positive(),
      sendEmailTo: z.email(),
      mailbox: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("standard") }),
        z.object({ kind: z.literal("custom"), localPart: z.string().trim().min(1) }),
      ]),
    })
  )
  .handler(async ({ data, context }) => {
    const result = await context.backend.azure.members.create.mutate(data)
    if (result.error !== null) throw new Error(result.error)
    return result
  })

/** Throws when the number is not saved; `notificationSent` is false when only the email failed. */
export const setAzureMemberNumber = createServerFn({ method: "POST" })
  .middleware([azureMembersWriteMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      assocNumber: z.number().int().positive(),
      notifyEmail: z.email().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const result = setMemberNumberResultSchema.parse(await context.backend.azure.members.setAssocNumber.mutate(data))
    if (result.error !== null) throw new Error(result.error)
    return result
  })
