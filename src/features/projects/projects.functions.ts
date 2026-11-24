import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import { parseEditProjectForm, parseProjectForm, projectIdInput, reorderProjectsInput } from "./projects.validation"
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
  .middleware([webContentWriteMiddleware])
  .validator(parseProjectForm)
  .handler(async ({ data, context }) => {
    const formData = projectFormData(data)
    const project = await context.backend.web.projects.addProject.mutate(formData)
    return projectFields(project)
  })

export const editProject = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(parseEditProjectForm)
  .handler(async ({ data, context }) => {
    const formData = projectFormData(data)
    formData.set("id", String(data.id))
    const result = await context.backend.web.projects.editProject.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return projectFields(result)
  })

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(projectIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.deleteProject.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderProjects = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(reorderProjectsInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.reorderProjects.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
