import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, webWriteAdminMiddleware } from "@/server/auth.middleware"

import { parseProjectForm } from "./projects.validation"
import type { Project } from "./types"

function projectFields(project: Project) {
  return {
    id: project.id,
    title: project.title,
    descriptionIt: project.descriptionIt,
    descriptionEn: project.descriptionEn,
    logo: project.logo,
    link: project.link,
    category: project.category,
  }
}

function projectFormData(data: ReturnType<typeof parseProjectForm>) {
  const formData = new FormData()
  formData.set("title", data.title)
  formData.set("descriptionIt", data.descriptionIt)
  formData.set("descriptionEn", data.descriptionEn)
  formData.set("link", data.link ?? "")
  formData.set("category", data.category)
  if (data.logoFile) formData.set("logo", data.logoFile)
  return formData
}

export const getProjects = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const projects = await context.backend.web.projects.getAllProjects.query()
    return projects.map(projectFields)
  })

export const createProject = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(parseProjectForm)
  .handler(async ({ data, context }) => {
    const formData = projectFormData(data)
    formData.set("createdBy", String(context.telegramId))
    const project = await context.backend.web.projects.addProject.mutate(formData)
    return projectFields(project)
  })

export const editProject = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator((data: FormData) => {
    const id = Number(data.get("id"))
    if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID_ID")
    return { id, ...parseProjectForm(data) }
  })
  .handler(async ({ data, context }) => {
    const formData = projectFormData(data)
    formData.set("id", String(data.id))
    formData.set("modifiedBy", String(context.telegramId))
    const result = await context.backend.web.projects.editProject.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return projectFields(result)
  })

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.deleteProject.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderProjects = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(z.object({ projectIds: z.array(z.number().int().positive()).min(1) }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.reorderProjects.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
