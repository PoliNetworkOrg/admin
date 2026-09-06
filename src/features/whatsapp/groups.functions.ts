import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, groupWriteAdminMiddleware } from "@/server/auth.middleware"

import { whatsappInviteLink } from "./whatsapp.validation"

export const getWhatsappGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.wa.groups.getAll.query())

const whatsappGroupFields = z.object({
  title: z.string().trim().min(1).max(200),
  link: whatsappInviteLink,
  hide: z.boolean().optional(),
})

export const createWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(whatsappGroupFields)
  .handler(({ data, context }) => context.backend.wa.groups.add.mutate(data))

export const editWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(whatsappGroupFields.extend({ id: z.number() }))
  .handler(async ({ data, context }) => {
    const updated = await context.backend.wa.groups.modify.mutate(data)
    if (!updated) throw new Error("NOT_FOUND")
    return updated
  })

export const deleteWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data, context }) => {
    const deleted = await context.backend.wa.groups.delete.mutate({ id: data.id })
    if (!deleted) throw new Error("NOT_FOUND")
    return { error: null }
  })

export const setWhatsappGroupVisibility = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(z.object({ id: z.number().int(), hide: z.boolean() }))
  .handler(async ({ data, context }) => {
    const updated = await context.backend.wa.groups.setHide.mutate(data)
    if (!updated) throw new Error("GROUP_VISIBILITY_NOT_UPDATED")
    return { updated: true as const }
  })
