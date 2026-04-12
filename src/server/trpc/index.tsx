import "server-only"

import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import SuperJSON from "superjson"
import { getBaseUrl } from "../../lib/utils"

const url = getBaseUrl() + TRPC_PATH
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url,
      transformer: SuperJSON,
    }),
  ],
})
