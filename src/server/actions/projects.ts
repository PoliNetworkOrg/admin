"use server"

import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { ApiInput } from "../trpc/types"

export async function createProject(input: Omit<ApiInput["web"]["projects"]["addProject"], "createdBy">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { project: null, error: "UNAUTHORIZED" }

  return {
    project: await trpc.web.projects.addProject.mutate({ ...input, createdBy: telegramId }),
    error: null,
  }
}

export async function editProject(input: Omit<ApiInput["web"]["projects"]["editProject"], "modifiedBy">) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { project: null, error: "UNAUTHORIZED" }

  const result = await trpc.web.projects.editProject.mutate({ ...input, modifiedBy: telegramId })
  if ("error" in result) return { project: null, error: result.error }

  return { project: result, error: null }
}

export async function deleteProject(id: number) {
  const { allowed } = await requireRole(["owner", "direttivo", "president"])
  if (!allowed) return { error: "UNAUTHORIZED" }

  return await trpc.web.projects.deleteProject.mutate({ id })
}
