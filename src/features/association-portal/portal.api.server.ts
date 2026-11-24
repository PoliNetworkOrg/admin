import { z } from "zod"

import { env } from "@/env"
import { createUntypedBackendClient } from "@/server/backend.server"

import { inItalian } from "./portal-errors"
import * as C from "./portal.contract"

type Context = {
  agentMode?: boolean
  session: { accessToken: string | null; user?: { sub: string; name: string; email: string } }
}
type PortalApi = ReturnType<typeof backendPortalApi>

function backendPortalApi(accessToken: string | null) {
  const backend = createUntypedBackendClient(accessToken)
  // The backend's English error sentences reach the page in Italian.
  const client = {
    query: (...args: Parameters<typeof backend.query>) => inItalian(() => backend.query(...args)),
    mutation: (...args: Parameters<typeof backend.mutation>) => inItalian(() => backend.mutation(...args)),
  }
  return {
    uploadLogo: async (input: FormData) =>
      z.object({ url: C.httpUrl }).parse(await client.mutation("associationPortal.uploadLogo", input)),
    list: async () => C.dashboardSchema.parse(await client.query("associationPortal.list")),
    home: async () => C.homeSchema.parse(await client.query("associationPortal.home")),
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
    uploadPoster: async (input: FormData) =>
      z.object({ url: C.httpUrl }).parse(await client.mutation("associationPortal.uploadPoster", input)),
    promotions: {
      list: async (input: z.infer<typeof C.refSchema>) =>
        C.promotionListSchema.parse(await client.query("associationPortal.promotions.list", input)),
      get: async (input: z.infer<typeof C.refSchema>) =>
        C.promotionSchema.parse(await client.query("associationPortal.promotions.get", input)),
      queue: async (input: z.infer<typeof C.promotionQueueSchema>) =>
        C.promotionListSchema.parse(await client.query("associationPortal.promotions.queue", input)),
      create: async (input: z.infer<typeof C.promotionCreateSchema>) =>
        C.refSchema.parse(await client.mutation("associationPortal.promotions.create", input)),
      command: async (input: C.PromotionCommand) =>
        C.refSchema.parse(await client.mutation("associationPortal.promotions.command", input)),
    },
    events: {
      list: async (input: z.infer<typeof C.refSchema>) =>
        C.calendarEventListSchema.parse(await client.query("associationPortal.events.list", input)),
      get: async (input: z.infer<typeof C.refSchema>) =>
        C.calendarEventSchema.parse(await client.query("associationPortal.events.get", input)),
      queue: async (input: z.infer<typeof C.calendarEventQueueSchema>) =>
        C.calendarEventListSchema.parse(await client.query("associationPortal.events.queue", input)),
      create: async (input: z.infer<typeof C.calendarEventCreateSchema>) =>
        C.refSchema.parse(await client.mutation("associationPortal.events.create", input)),
      command: async (input: C.CalendarEventCommand) =>
        C.refSchema.parse(await client.mutation("associationPortal.events.command", input)),
    },
  }
}

/** Agent mode without a backend token: the sample registry, parsed through the same contract as the backend's replies. */
async function fakePortalApi(user: { sub: string; name: string; email: string }): Promise<PortalApi> {
  const { fakePortalApi: fake } = await import("./portal.fake.server")
  const { viewer, service, promotions, home, events } = fake(user, env.AGENT_ASSOCIATION_ROLE)
  return {
    // No Blob storage in agent mode: an upload sets the dashboard's own icon as the logo.
    uploadLogo: async () => ({ url: `http://localhost:${process.env.PORT ?? "3000"}/favicon.ico` }),
    list: async () => C.dashboardSchema.parse(await inItalian(() => service.list(viewer))),
    home: async () => C.homeSchema.parse(await inItalian(() => home.home(viewer))),
    directory: async () => C.directorySchema.parse(await inItalian(() => service.directory(viewer))),
    catalogue: async () => C.catalogueSchema.parse(await inItalian(() => service.catalogue(viewer))),
    saveCatalogue: async (input) => {
      await inItalian(() => service.saveCatalogue(viewer, input))
      return { ok: true as const }
    },
    get: async (input) => C.detailSchema.parse(await inItalian(() => service.get(viewer, input.id))),
    create: async (input) => C.refSchema.parse(await inItalian(() => service.create(viewer, input))),
    command: async (input) => C.refSchema.parse(await inItalian(() => service.command(viewer, input))),
    invitation: async (input) => C.invitationSchema.parse(await inItalian(() => service.invitation(input.token))),
    accept: async (input) => C.refSchema.parse(await inItalian(() => service.accept(viewer, input.token))),
    uploadPoster: async () => ({ url: `http://localhost:${process.env.PORT ?? "3000"}/favicon.ico` }),
    promotions: {
      list: async (input) => C.promotionListSchema.parse(await inItalian(() => promotions.list(viewer, input.id))),
      get: async (input) => C.promotionSchema.parse(await inItalian(() => promotions.get(viewer, input.id))),
      queue: async (input) => C.promotionListSchema.parse(await inItalian(() => promotions.queue(viewer, input))),
      create: async (input) => C.refSchema.parse(await inItalian(() => promotions.create(viewer, input))),
      command: async (input) => C.refSchema.parse(await inItalian(() => promotions.command(viewer, input))),
    },
    events: {
      list: async (input) => C.calendarEventListSchema.parse(await inItalian(() => events.list(viewer, input.id))),
      get: async (input) => C.calendarEventSchema.parse(await inItalian(() => events.get(viewer, input.id))),
      queue: async (input) => C.calendarEventListSchema.parse(await inItalian(() => events.queue(viewer, input))),
      create: async (input) => C.refSchema.parse(await inItalian(() => events.create(viewer, input))),
      command: async (input) => C.refSchema.parse(await inItalian(() => events.command(viewer, input))),
    },
  }
}

/** The portal API for this request: the sample registry in agent mode, the backend otherwise. */
export async function portalApi(context: Context): Promise<PortalApi> {
  if (context.agentMode && !env.AGENT_BACKEND_TOKEN && context.session.user) return fakePortalApi(context.session.user)
  return backendPortalApi(context.session.accessToken)
}
