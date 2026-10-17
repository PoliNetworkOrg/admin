import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { esignDrivesManageMiddleware } from "@/server/auth.middleware"

const key = z.string().regex(/^[A-Za-z0-9:._-]{1,100}$/)
const rule = z.object({ roles: z.array(key).max(50), permissions: z.array(key).max(50) })

/** Every drive's access rules, with the roles and permissions a rule can name. */
export const getEsignDriveAccess = createServerFn()
  .middleware([esignDrivesManageMiddleware])
  .handler(({ context }) => context.backend.esign.drive.access.query())

export const setEsignDriveAccess = createServerFn({ method: "POST" })
  .middleware([esignDrivesManageMiddleware])
  .validator(z.object({ driveId: z.string().min(1), request: rule, sign: rule }))
  .handler(({ data, context }) => context.backend.esign.drive.setAccess.mutate(data))
