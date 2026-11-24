import { z } from "zod"

import { env } from "@/env"
import { createUntypedBackendClient } from "@/server/backend.server"

import * as C from "./portal.contract"

type Context = {
  agentMode?: boolean
  session: { accessToken: string | null; user?: { sub: string; name: string; email: string } }
}
type PortalApi = ReturnType<typeof backendPortalApi>

function backendPortalApi(accessToken: string | null) {
  const client = createUntypedBackendClient(accessToken)
  return {
    uploadLogo: async (input: FormData) =>
      z.object({ url: C.httpUrl }).parse(await client.mutation("associationPortal.uploadLogo", input)),
    list: async () => C.dashboardSchema.parse(await client.query("associationPortal.list")),
    directory: async () => C.directorySchema.parse(await client.query("associationPortal.directory")),
    catalogue: async () => C.catalogueSchema.parse(await client.query("associationPortal.catalogue")),
    saveCatalogue: async (input: C.CatalogueEntry) =>
      z.object({ ok: z.literal(true) }).parse(await client.mutation("associationPortal.saveCatalogue", input)),
    get: async (input: z.infer<typeof C.refSchema>) =>
      C.detailSchema.parse(await client.query("associationPortal.get", input)),
    create: async (input: z.infer<typeof C.createSchema>) =>
      C.refSchema.parse(await client.mutation("associationPortal.create", input)),
    command: async (input: C.Command) => C.refSchema.parse(await client.mutation("associationPortal.command", input)),
    invitation: async (input: z.infer<typeof C.inviteSchema>) =>
      C.invitationSchema.parse(await client.query("associationPortal.invitation", input)),
    accept: async (input: z.infer<typeof C.inviteSchema>) =>
      C.refSchema.parse(await client.mutation("associationPortal.accept", input)),
  }
}

/** Agent mode without a backend token: the sample registry, parsed through the same contract as the backend's replies. */
async function fakePortalApi(user: { sub: string; name: string; email: string }): Promise<PortalApi> {
  const { fakePortalApi: fake } = await import("./portal.fake.server")
  const { viewer, service } = fake(user, env.AGENT_ASSOCIATION_ROLE)
  return {
    // No Blob storage in agent mode: an upload sets the dashboard's own icon as the logo.
    uploadLogo: async () => ({ url: `http://localhost:${process.env.PORT ?? "3000"}/favicon.ico` }),
    list: async () => C.dashboardSchema.parse(await service.list(viewer)),
    directory: async () => C.directorySchema.parse(await service.directory(viewer)),
    catalogue: async () => C.catalogueSchema.parse(await service.catalogue(viewer)),
    saveCatalogue: async (input) => {
      await service.saveCatalogue(viewer, input)
      return { ok: true as const }
    },
    get: async (input) => C.detailSchema.parse(await service.get(viewer, input.id)),
    create: async (input) => C.refSchema.parse(await service.create(viewer, input)),
    command: async (input) => C.refSchema.parse(await service.command(viewer, input)),
    invitation: async (input) => C.invitationSchema.parse(await service.invitation(input.token)),
    accept: async (input) => C.refSchema.parse(await service.accept(viewer, input.token)),
  }
}

/** The portal API for this request: the sample registry in agent mode, the backend otherwise. */
export async function portalApi(context: Context): Promise<PortalApi> {
  if (context.agentMode && !env.AGENT_BACKEND_TOKEN && context.session.user) return fakePortalApi(context.session.user)
  return backendPortalApi(context.session.accessToken)
}
