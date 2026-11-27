import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import { guideIdInput, parseGuideForm } from "./guides.validation"

export const getGuides = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.guides_matricole.getAllGuides.query())

export const createGuide = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(parseGuideForm)
  .handler(async ({ data, context }) => {
    const formData = new FormData()
    formData.set("version", data.version)
    formData.set("date", data.date)
    formData.set("file", data.file)

    const result = await context.backend.web.guides_matricole.addGuide.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return { id: result.id, version: result.version, date: result.date, file: result.file }
  })

export const deleteGuide = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(guideIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.guides_matricole.deleteGuide.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
