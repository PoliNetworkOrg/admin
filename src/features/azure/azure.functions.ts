import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

export const getAzureMembers = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.azure.members.getAll.query())

export const getAzureDirectory = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const [groups, members] = await Promise.all([
      context.backend.azure.groups.getAll.query(),
      context.backend.azure.members.getAll.query(),
    ])
    return { groups, members }
  })

export const createAzureMember = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(
    z.object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      assocNumber: z.number().int().positive(),
      sendEmailTo: z.email(),
    })
  )
  .handler(async ({ data, context }) => {
    const result = await context.backend.azure.members.create.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const setAzureMemberNumber = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ userId: z.string().min(1), assocNumber: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.azure.members.setAssocNumber.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

const azureGroupMembershipInput = z.object({ groupId: z.string().min(1), userId: z.string().min(1) })

export const addAzureGroupMember = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(azureGroupMembershipInput)
  .handler(async ({ data, context }) => ({
    error: (await context.backend.azure.groups.addMember.mutate(data)) ? null : ("INTERNAL_SERVER_ERROR" as const),
  }))

export const removeAzureGroupMember = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(azureGroupMembershipInput)
  .handler(async ({ data, context }) => ({
    error: (await context.backend.azure.groups.removeMember.mutate(data)) ? null : ("INTERNAL_SERVER_ERROR" as const),
  }))
