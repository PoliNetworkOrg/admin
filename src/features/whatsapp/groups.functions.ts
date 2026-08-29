import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

export const getWhatsappGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.wa.groups.getAll.query())

const whatsappGroupFields = z.object({
  title: z.string().trim().min(1).max(200),
  tag: z.string().trim().optional(),
  link: z.url({ hostname: /^chat\.whatsapp\.com$/ }),
})

export const createWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(whatsappGroupFields)
  .handler(async ({ data, context }) => {
    const [created] = await context.backend.wa.groups.create.mutate(data)
    if (!created) throw new Error("The group could not be created.")
    return created
  })

export const editWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(whatsappGroupFields.extend({ id: z.number() }))
  .handler(async ({ data, context }) => {
    const { id, ...values } = data
    const [updated] = await context.backend.wa.groups.modify.mutate({ id, ...values })
    if (!updated) throw new Error("NOT_FOUND")
    return updated
  })

export const deleteWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data, context }) => {
    await context.backend.wa.groups.delete.mutate({ id: data.id })
    return { error: null }
  })
