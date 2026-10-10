import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { azureMembersCreateMiddleware } from "@/server/auth.middleware"

export const createAzureMember = createServerFn({ method: "POST" })
  .middleware([azureMembersCreateMiddleware])
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
