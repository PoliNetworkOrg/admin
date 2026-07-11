import { type AppRouter, AUTH_PATH, TRPC_PATH } from "@polinetwork/backend"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from "@trpc/client"
import SuperJSON from "superjson"
import { z } from "zod"

export type BackendState<T> = { data: T; connected: boolean; message?: string }

export type AdminSession = {
  session?: { id?: string; expiresAt?: Date | string }
  user?: {
    id: string
    email?: string
    name?: string | null
    image?: string | null
    telegramId?: number | null
    telegramUsername?: string | null
  }
}

function backendOrigin() {
  return process.env.BACKEND_URL ?? "http://localhost:3000"
}

function requestHeaders(): Record<string, string> {
  const cookie = getRequestHeader("cookie")
  return cookie ? { cookie } : {}
}

function client() {
  const url = `${backendOrigin()}${TRPC_PATH}`
  const headers = requestHeaders()

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (operation) => isNonJsonSerializable(operation.input),
        true: httpLink({
          url,
          headers,
          transformer: {
            serialize: (data) => data,
            deserialize: (data) => SuperJSON.deserialize(data),
          },
        }),
        false: httpBatchLink({ url, headers, transformer: SuperJSON }),
      }),
    ],
  })
}

export const testBackend = createServerFn().handler(async () => {
  try {
    await client().test.dbQuery.query({ dbName: "web" })
    return true
  } catch (e) {
    console.error("Backend error: ", e)
    return false
  }
})

async function readSession(): Promise<AdminSession | null> {
  try {
    const response = await fetch(new URL(`${AUTH_PATH}/get-session`, backendOrigin()), {
      headers: requestHeaders(),
      cache: "no-store",
    })

    if (!response.ok) return null
    return (await response.json()) as AdminSession
  } catch {
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

  const { roles } = await client().tg.permissions.getRoles.query({ userId: telegramId })
  if (!roles?.some((role) => ["owner", "direttivo", "president"].includes(role))) {
    throw new Error("UNAUTHORIZED")
  }

  return { session, telegramId }
}

async function safely<T>(request: () => Promise<T>): Promise<BackendState<T | []>> {
  try {
    await requireSession()
    return { data: await request(), connected: true }
  } catch (error) {
    const message =
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Your session is no longer valid. Sign in again to load this data."
        : "The PoliNetwork backend is currently unavailable."

    return { data: [], connected: false, message }
  }
}

export const getCurrentSession = createServerFn().handler(readSession)

export const getTelegramUsers = createServerFn().handler(() => safely(() => client().tg.users.getAll.query()))

export const getTelegramGroups = createServerFn().handler(() => safely(() => client().tg.groups.getAll.query()))

export const getOngoingGrants = createServerFn().handler(() => safely(() => client().tg.grants.getOngoing.query()))

export const getScheduledGrants = createServerFn().handler(() => safely(() => client().tg.grants.getScheduled.query()))

export const getAzureMembers = createServerFn().handler(() => safely(() => client().azure.members.getAll.query()))

export const getTelegramUserDetails = createServerFn()
  .validator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    return safely(async () => {
      const api = client()
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
    return client().tg.groups.setHide.mutate(data)
  })

export const addTelegramGroupAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.number().int().positive(), groupId: z.number().int() }))
  .handler(async ({ data }) => {
    const { telegramId } = await requireAdminRole()
    return client().tg.permissions.addGroup.mutate({ ...data, adderId: telegramId })
  })

export const createAzureMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      assocNumber: z.number().int().positive(),
      sendEmailTo: z.string().email(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdminRole()
    const result = await client().azure.members.create.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const setAzureMemberNumber = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1), assocNumber: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireAdminRole()
    const result = await client().azure.members.setAssocNumber.mutate(data)
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
    return client().auth.updateProfilePic.mutate(formData)
  })
