import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware, groupWriteAdminMiddleware } from "@/server/auth.middleware"

export const getPendingGroupLinkReports = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.reports.list.query({ statuses: ["pending"] }))

export const getResolvedGroupLinkReports = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.reports.list.query({ statuses: ["resolved", "dismissed"] }))

export const resolveGroupLinkReport = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(z.object({ ids: z.array(z.number().int()).min(1) }))
  .handler(({ data, context }) => context.backend.web.reports.resolve.mutate(data))

export const dismissGroupLinkReport = createServerFn({ method: "POST" })
  .middleware([groupWriteAdminMiddleware])
  .validator(z.object({ ids: z.array(z.number().int()).min(1) }))
  .handler(({ data, context }) => context.backend.web.reports.dismiss.mutate(data))
