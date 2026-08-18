import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { adminMiddleware } from "@/server/auth.middleware"
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

async function resolveLogo(currentLogo: string | null, logoFile: File | null) {
  if (!logoFile) return currentLogo
  const content = Buffer.from(await logoFile.arrayBuffer()).toString("base64")
  return `data:${logoFile.type};base64,${content}`
}

export const getProjects = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const projects = await context.backend.web.projects.getAllProjects.query()
    return projects.map(projectFields)
  })

export const createProject = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(parseProjectForm)
  .handler(async ({ data, context }) => {
    const { logoFile, ...fields } = data
    const project = await context.backend.web.projects.addProject.mutate({
      ...fields,
      logo: await resolveLogo(fields.logo, logoFile),
      createdBy: context.telegramId,
    })
    return projectFields(project)
  })

export const editProject = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: FormData) => {
    const id = Number(data.get("id"))
    if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID_ID")
    return { id, ...parseProjectForm(data) }
  })
  .handler(async ({ data, context }) => {
    const { logoFile, ...fields } = data
    const result = await context.backend.web.projects.editProject.mutate({
      ...fields,
      logo: await resolveLogo(fields.logo, logoFile),
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return projectFields(result)
  })

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.deleteProject.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderProjects = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ projectIds: z.array(z.number().int().positive()).min(1) }))
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.projects.reorderProjects.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
