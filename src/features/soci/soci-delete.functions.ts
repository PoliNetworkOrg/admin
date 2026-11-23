import { createServerFn } from "@tanstack/react-start"

import { sociDeleteMiddleware } from "@/server/auth.middleware"

import { sociApi } from "./soci.api.server"
import { deleteAccountInputSchema } from "./soci.contract"

export const deleteSocioAccount = createServerFn({ method: "POST" })
  .middleware([sociDeleteMiddleware])
  .validator(deleteAccountInputSchema)
  .handler(async ({ data, context }) => (await sociApi(context)).deleteAccount(data))
