import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { z } from "zod"
import { env } from "@/env"
import { trpc } from "@/lib/api"
import { auth } from "@/lib/auth"

export type BackendState<T> = { data: T; connected: boolean; message?: string }

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.getSession>>["data"]>

const agentSession = {
  session: {
    id: "agent-preview-session",
    token: "agent-preview-token",
    userId: "agent-preview-user",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  user: {
    id: "agent-preview-user",
    name: "Preview Agent",
    email: "agent@polinetwork.org",
    emailVerified: true,
    image: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    telegramId: 1,
    telegramUsername: "preview-agent",
  },
} as unknown as AuthSession

export const testBackend = createServerFn().handler(async () => {
  try {
    await trpc.test.dbQuery.query({ dbName: "web" })
    return true
  } catch (e) {
    console.error("Backend error: ", e)
    return false
  }
})

async function readSession() {
  if (env.AGENT_MODE) return agentSession

  try {
    const response = await auth.getSession({ fetchOptions: { headers: getRequestHeaders() } })
    if (response.error) {
      console.error("SESSION ERROR", response.error.statusText, response.error.message)
    }

    return response.data
  } catch (err) {
    console.error(err)
    return null
  }
}

async function requireSession() {
  const session = await readSession()
  if (!session?.user) throw new Error("UNAUTHORIZED")
  return session
}

async function requireAdminRole() {
  const session = await requireSession()
  const telegramId = session.user?.telegramId
  if (!telegramId) throw new Error("TELEGRAM_NOT_LINKED")

  if (env.AGENT_MODE) return { session, telegramId }

  const { roles } = await trpc.tg.permissions.getRoles.query({ userId: telegramId })
  if (!roles?.some((role) => ["owner", "direttivo", "president"].includes(role))) {
    throw new Error("UNAUTHORIZED")
  }

  return { session, telegramId }
}

async function safely<T>(request: () => Promise<T>): Promise<BackendState<T | null>> {
  try {
    await requireSession()
    return { data: await request(), connected: true }
  } catch (error) {
    const message =
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Your session is no longer valid. Sign in again to load this data."
        : "The PoliNetwork backend is currently unavailable."

    return { data: null, connected: false, message }
  }
}

export type AdminSession = NonNullable<Awaited<ReturnType<typeof readSession>>>

export const getCurrentSession = createServerFn().handler(readSession)

export const getAgentMode = createServerFn().handler(() => (env.NODE_ENV === "development" ? env.AGENT_MODE : false))

export const getTelegramUsers = createServerFn().handler(() => safely(() => trpc.tg.users.getAll.query()))

export const getTelegramGroups = createServerFn().handler(() => safely(() => trpc.tg.groups.getAll.query()))

export const getOngoingGrants = createServerFn().handler(() => safely(() => trpc.tg.grants.getOngoing.query()))

export const getScheduledGrants = createServerFn().handler(() => safely(() => trpc.tg.grants.getScheduled.query()))

export const getAzureMembers = createServerFn().handler(() => safely(() => trpc.azure.members.getAll.query()))

export const getAzureGroups = createServerFn().handler(() => safely(() => trpc.azure.groups.getAll.query()))

export const getGuides = createServerFn().handler(() => safely(() => trpc.web.guides_matricole.getAllGuides.query()))

export const getTelegramUserDetails = createServerFn()
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    return safely(async () => {
      const api = trpc
      const { user } = await api.tg.users.get.query({ userId: data.userId })
      if (!user) return null

      const [permissions, messages, audits, grant] = await Promise.all([
        api.tg.permissions.getRoles.query({ userId: user.id }),
        api.tg.messages.getLastByUser.query({ userId: user.id, limit: 15 }),
        api.tg.auditLog.getById.query({ targetId: user.id }),
        api.tg.grants.checkUser.query({ userId: user.id }),
      ])

      return {
        user,
        roles: permissions.roles ?? [],
        groupAdmin: permissions.groupAdmin.filter(Boolean),
        groups: await api.tg.groups.getAll.query(),
        messages: messages.messages ?? [],
        audits,
        grant: grant.grant ?? null,
      }
    })
  })

export const setGroupVisibility = createServerFn({ method: "POST" })
  .validator(z.object({ telegramId: z.number().int(), hide: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdminRole()
    return trpc.tg.groups.setHide.mutate(data)
  })

export const addTelegramGroupAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.number().int().positive(), groupId: z.number().int() }))
  .handler(async ({ data }) => {
    const { telegramId } = await requireAdminRole()
    return trpc.tg.permissions.addGroup.mutate({ ...data, adderId: telegramId })
  })

export const createAzureMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      assocNumber: z.number().int().positive(),
      sendEmailTo: z.email(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdminRole()
    const result = await trpc.azure.members.create.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const setAzureMemberNumber = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1), assocNumber: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireAdminRole()
    const result = await trpc.azure.members.setAssocNumber.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

const azureGroupMembershipInput = z.object({ groupId: z.string().min(1), userId: z.string().min(1) })

async function updateAzureGroupMembership(
  operation: () => Promise<boolean>
): Promise<{ error: "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR" | null }> {
  try {
    await requireAdminRole()
    return { error: (await operation()) ? null : "INTERNAL_SERVER_ERROR" }
  } catch (error) {
    console.error(error)
    return {
      error:
        error instanceof Error && ["UNAUTHORIZED", "TELEGRAM_NOT_LINKED"].includes(error.message)
          ? "UNAUTHORIZED"
          : "INTERNAL_SERVER_ERROR",
    }
  }
}

export const addAzureGroupMember = createServerFn({ method: "POST" })
  .validator(azureGroupMembershipInput)
  .handler(({ data }) => updateAzureGroupMembership(() => trpc.azure.groups.addMember.mutate(data)))

export const removeAzureGroupMember = createServerFn({ method: "POST" })
  .validator(azureGroupMembershipInput)
  .handler(({ data }) => updateAzureGroupMembership(() => trpc.azure.groups.removeMember.mutate(data)))

export const createGuide = createServerFn({ method: "POST", strict: false })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const { telegramId } = await requireAdminRole()
    const version = data.get("version")
    const date = data.get("date")
    const file = data.get("file")

    if (typeof version !== "string" || !version.trim()) throw new Error("INVALID_VERSION")
    if (typeof date !== "string" || Number.isNaN(Date.parse(date))) throw new Error("INVALID_DATE")
    if (!(file instanceof File) || file.type !== "application/pdf") throw new Error("INVALID_FILE_TYPE")
    if (file.size > 2 * 1024 * 1024) throw new Error("FILE_TOO_LARGE")

    const formData = new FormData()
    formData.set("version", version.trim())
    formData.set("date", date)
    formData.set("file", file)
    formData.set("createdBy", String(telegramId))

    const result = await trpc.web.guides_matricole.addGuide.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return { id: result.id, version: result.version, date: result.date, file: result.file }
  })

export const deleteGuide = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireAdminRole()
    const result = await trpc.web.guides_matricole.deleteGuide.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const uploadProfilePicture = createServerFn({ method: "POST", strict: false })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const session = await requireSession()
    const image = data.get("image")
    if (!(image instanceof File)) throw new Error("INVALID_IMAGE")
    if (image.size > 1024 * 1024) throw new Error("IMAGE_TOO_LARGE")
    if (!["image/png", "image/jpeg"].includes(image.type)) throw new Error("INVALID_IMAGE_TYPE")

    const formData = new FormData()
    formData.set("userId", session.user?.id ?? "")
    formData.set("image", image)
    return trpc.auth.updateProfilePic.mutate(formData)
  })
