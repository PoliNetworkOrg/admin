import { z } from "zod"

import { createUntypedBackendClient } from "@/server/backend.server"

import * as C from "./portal.contract"

type Context = { session: { accessToken: string | null } }
export function portalApi(context: Context) {
  const client = createUntypedBackendClient(context.session.accessToken)
  return {
    uploadLogo: async (input: FormData) =>
      z.object({ url: C.httpUrl }).parse(await client.mutation("associationPortal.uploadLogo", input)),
    list: async () => C.dashboardSchema.parse(await client.query("associationPortal.list")),
    directory: async () => C.directorySchema.parse(await client.query("associationPortal.directory")),
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
