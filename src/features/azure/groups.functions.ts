import { createServerFn } from "@tanstack/react-start"

import { azureGroupsReadMiddleware } from "@/server/auth.middleware"

export const getAzureGroups = createServerFn({ method: "GET" })
  .middleware([azureGroupsReadMiddleware])
  .handler(({ context }) => context.backend.azure.groups.getAll.query())
