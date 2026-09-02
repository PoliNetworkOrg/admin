import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { adminMiddleware } from "@/server/auth.middleware"

import { moderationAuditSchema, type ModerationAudit } from "./user-detail/types"

type ModerationAuditRouter = {
  getAll: {
    query: (input: { limit: number }) => Promise<ModerationAudit[]>
  }
}

export const getModerationAudits = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    // The backend package is released separately from the dashboard. This cast can
    // go away once the package version containing auditLog.getAll is published.
    const untypedAuditLog: unknown = context.backend.tg.auditLog
    // SAFETY: Backend deployment and database migration precede the dashboard release.
    const auditLog = untypedAuditLog as ModerationAuditRouter
    const audits = await auditLog.getAll.query({ limit: 200 })
    return z.array(moderationAuditSchema).parse(audits)
  })
