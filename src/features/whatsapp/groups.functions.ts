import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, webWriteAdminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

export const getWhatsappGroups = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.wa.groups.getAll.query())

const whatsappGroupFields = z.object({
  title: z.string().trim().min(1).max(200),
  tag: z.string().trim().optional(),
  link: z.url({ hostname: /^chat\.whatsapp\.com$/ }),
})

export const createWhatsappGroup = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
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
    waGroupLabelRelations = waGroupLabelRelations.filter((relation) => relation.groupId !== data.id)
    return { error: null }
  })

export type WaGroupLabelRelation = { groupId: number; label: string }

/**
 * TODO: placeholder in-memory store (resets on server restart). Replace with a real `wa_group_label_relations`
 * table (mirroring the tg one) once WhatsApp groups get backend-persisted labels.
 */
let waGroupLabelRelations: WaGroupLabelRelation[] = []

export const getWhatsappGroupLabelRelations = createServerFn()
  .middleware([adminMiddleware])
  .handler(() => waGroupLabelRelations)

export const setWhatsappGroupLabels = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(z.object({ groupId: z.number(), labels: z.array(z.string()) }))
  .handler(({ data }) => {
    waGroupLabelRelations = [
      ...waGroupLabelRelations.filter((relation) => relation.groupId !== data.groupId),
      ...data.labels.map((label) => ({ groupId: data.groupId, label })),
    ]
    return waGroupLabelRelations
  })
