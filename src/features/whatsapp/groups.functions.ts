import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, whatsappGroupsWriteMiddleware } from "@/server/auth.middleware"

import { whatsappInviteLink } from "./whatsapp.validation"

export const getWhatsappGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.wa.groups.getAll.query())

export const whatsappGroupInput = z.object({
  title: z.string().trim().min(1).max(200),
  link: whatsappInviteLink,
  hide: z.boolean().optional(),
})

export const editWhatsappGroupInput = whatsappGroupInput.extend({ id: z.number() })
export const whatsappGroupIdInput = z.object({ id: z.number() })
export const whatsappGroupVisibilityInput = z.object({ id: z.number().int(), hide: z.boolean() })

export const createWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([whatsappGroupsWriteMiddleware])
  .validator(whatsappGroupInput)
  .handler(({ data, context }) => context.backend.wa.groups.add.mutate(data))

export const editWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([whatsappGroupsWriteMiddleware])
  .validator(editWhatsappGroupInput)
  .handler(async ({ data, context }) => {
    const updated = await context.backend.wa.groups.modify.mutate(data)
    if (!updated) throw new Error("NOT_FOUND")
    return updated
  })

export const deleteWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([whatsappGroupsWriteMiddleware])
  .validator(whatsappGroupIdInput)
  .handler(async ({ data, context }) => {
    const deleted = await context.backend.wa.groups.delete.mutate({ id: data.id })
    if (!deleted) throw new Error("NOT_FOUND")
    return { error: null }
  })

export const setWhatsappGroupVisibility = createServerFn({ method: "POST" })
  .middleware([whatsappGroupsWriteMiddleware])
  .validator(whatsappGroupVisibilityInput)
  .handler(async ({ data, context }) => {
    const updated = await context.backend.wa.groups.setHide.mutate(data)
    if (!updated) throw new Error("GROUP_VISIBILITY_NOT_UPDATED")
    return { updated: true as const }
  })
