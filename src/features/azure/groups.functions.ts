import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { azureGroupsReadMiddleware, azureGroupsWriteMiddleware } from "@/server/auth.middleware"

export const getAzureGroups = createServerFn({ method: "GET" })
  .middleware([azureGroupsReadMiddleware])
  .handler(({ context }) => context.backend.azure.groups.getAll.query())

const azureGroupMembershipInput = z.object({ groupId: z.string().min(1), userId: z.string().min(1) })

export const addAzureGroupMember = createServerFn({ method: "POST" })
  .middleware([azureGroupsWriteMiddleware])
  .validator(azureGroupMembershipInput)
  .handler(async ({ data, context }) => ({
    error: (await context.backend.azure.groups.addMember.mutate(data)) ? null : ("INTERNAL_SERVER_ERROR" as const),
  }))

export const removeAzureGroupMember = createServerFn({ method: "POST" })
  .middleware([azureGroupsWriteMiddleware])
  .validator(azureGroupMembershipInput)
  .handler(async ({ data, context }) => ({
    error: (await context.backend.azure.groups.removeMember.mutate(data)) ? null : ("INTERNAL_SERVER_ERROR" as const),
  }))
