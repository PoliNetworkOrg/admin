"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput, ApiOutput } from "../trpc/types"

type ProjectCategory = ApiOutput["web"]["projects"]["getAllProjects"][number]["category"]

type ProjectFields = {
  title: string
  descriptionIt: string
  descriptionEn: string
  link: string | null
  category: ProjectCategory
  logoFile?: File | null
}

function getProjectFormData(input: ProjectFields) {
  const formData = new FormData()
  formData.set("title", input.title)
  formData.set("descriptionIt", input.descriptionIt)
  formData.set("descriptionEn", input.descriptionEn)
  formData.set("link", input.link ?? "")
  formData.set("category", input.category)
  if (input.logoFile) formData.set("logo", input.logoFile)
  return formData
}

export async function createProject(input: ProjectFields) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { project: null, error: "UNAUTHORIZED" }

  const formData = getProjectFormData(input)
  formData.set("createdBy", String(telegramId))

  return {
    project: await trpc.web.projects.addProject.mutate(formData),
    error: null,
  }
}

export async function editProject(input: ProjectFields & { id: number }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { project: null, error: "UNAUTHORIZED" }

  const formData = getProjectFormData(input)
  formData.set("id", String(input.id))
  formData.set("modifiedBy", String(telegramId))

  const result = await trpc.web.projects.editProject.mutate(formData)
  if ("error" in result) return { project: null, error: result.error }

  return { project: result, error: null }
}

export async function deleteProject(id: number) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.web.projects.deleteProject.mutate({ id })
}

export async function reorderProjects(input: ApiInput["web"]["projects"]["reorderProjects"]) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.web.projects.reorderProjects.mutate(input)
}
