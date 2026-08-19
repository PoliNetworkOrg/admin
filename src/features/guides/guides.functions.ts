import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"
import { parseGuideForm } from "./guides.validation"

export const getGuides = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.guides_matricole.getAllGuides.query())

export const createGuide = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(parseGuideForm)
  .handler(async ({ data, context }) => {
    const formData = new FormData()
    formData.set("version", data.version)
    formData.set("date", data.date)
    formData.set("file", data.file)
    formData.set("createdBy", String(context.telegramId))

    const result = await context.backend.web.guides_matricole.addGuide.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return { id: result.id, version: result.version, date: result.date, file: result.file }
  })

export const deleteGuide = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.guides_matricole.deleteGuide.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
