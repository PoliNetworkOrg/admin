import { createServerFn } from "@tanstack/react-start"

import { azureMembersReadMiddleware } from "@/server/auth.middleware"

/** The directory, read-only: soci are admitted and renumbered from People › Soci. */
export const getAzureMembers = createServerFn({ method: "GET" })
  .middleware([azureMembersReadMiddleware])
  .handler(({ context }) => context.backend.azure.members.getAll.query())
